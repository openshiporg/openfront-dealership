// Record invariants the commands enforce in front of the database CHECKs and partial unique indexes
// (migration 20261107180000_dealership_record_invariants).
// Run: node --test tests/*.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext(output, { module: loaded, exports: loaded.exports, require: id => mocks[id] || require(id), console }, { filename });
  return loaded.exports;
}

const access = { permissions: { canManageService: () => true } };
const tenant = { assertSessionRooftopPermission: async () => {} };
const FUTURE = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 12, 15, 20)).toISOString();
const events = { recordDomainEventInTransaction: async () => ({ reused: false }), domainEventRequestHash: () => 'h' };

test('a repair order cannot open with a grand total that is not labor + parts + tax', async () => {
  const { openServiceOrder } = load('features/keystone/mutations/openServiceOrder.ts', {
    '../access': access, '../tenantRecords': tenant, '../lifecycle/domainEvents': events,
  });
  let transactions = 0;
  const context = {
    session: { itemId: 'u1' },
    query: { ServiceAppointment: { findOne: async () => ({ id: 'a1', rooftop: { id: 'r1' }, status: 'scheduled', serviceOrder: null }) } },
    transaction: async () => { transactions += 1; return 'so1' },
  };
  const data = { appointmentId: 'a1', idempotencyKey: 'service-order:a1', laborTotalCents: 1000, partsTotalCents: 500, taxCents: 100 };
  await assert.rejects(openServiceOrder(null, { data: { ...data, grandTotalCents: 9999 } }, context), /Grand total must equal labor plus parts plus tax/);
  assert.equal(transactions, 0);
});

function rescheduleHarness({ count, status = 'scheduled', changed = 1 }) {
  const capacity = load('features/keystone/mutations/bookingCapacity.ts', { './submissionErrors': load('features/keystone/mutations/submissionErrors.ts') });
  const workflows = load('features/keystone/mutations/operatorWorkflows.ts', {
    '../lifecycle/serviceAppointmentTransitions': { SERVICE_APPOINTMENT_TRANSITIONS: {} },
    '../access': access, '../lifecycle/domainEvents': events, '../tenantRecords': tenant,
    './customerBookings': {}, './bookingCapacity': capacity,
  });
  const writes = [];
  const tx = {
    prisma: {
      $queryRaw: async () => [], $executeRaw: async () => 0,
      domainAuditEvent: { findUnique: async () => null },
      serviceAppointment: { count: async () => count, updateMany: async args => { writes.push(args); return { count: changed } } },
    },
  };
  const context = {
    session: { itemId: 'u1' },
    query: { ServiceAppointment: { findOne: async () => ({ id: 'a1', status, appointmentDate: '2026-11-10T14:00:00.000Z', rooftop: { id: 'r1' }, updatedAt: '2026-11-07T00:00:00.000Z' }) } },
    db: { ServiceAppointment: { findOne: async () => ({ id: 'a1' }) } },
    transaction: async fn => fn(tx),
  };
  return { reschedule: workflows.rescheduleServiceAppointment, context, writes };
}

test('staff reschedule refuses a full hourly slot and writes nothing', async () => {
  const { reschedule, context, writes } = rescheduleHarness({ count: 4 });
  await assert.rejects(reschedule(null, { id: 'a1', appointmentDate: FUTURE, idempotencyKey: 'reschedule-1' }, context), /service capacity slot is full/);
  assert.equal(writes.length, 0);
});

test('staff reschedule moves the appointment and stamps the hour slot it now holds', async () => {
  const { reschedule, context, writes } = rescheduleHarness({ count: 3 });
  await reschedule(null, { id: 'a1', appointmentDate: FUTURE, idempotencyKey: 'reschedule-2' }, context);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.capacitySlot, FUTURE.slice(0, 13) + ':00:00.000Z');
  assert.equal(writes[0].where.status, 'scheduled');
});

test('closed appointments cannot be rescheduled', async () => {
  const { reschedule, context } = rescheduleHarness({ count: 0, status: 'completed' });
  await assert.rejects(reschedule(null, { id: 'a1', appointmentDate: FUTURE, idempotencyKey: 'reschedule-3' }, context), /Only scheduled or checked-in/);
});

test('the migration backs each command rule with a constraint', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../migrations/20261107180000_dealership_record_invariants/migration.sql'), 'utf8');
  for (const name of ['VehicleImage_single_primary_key', 'Deal_single_active_per_vehicle_key', 'FinanceProductCancellation_single_completed_key',
    'ServiceOrder_total_matches_parts_check', 'RepairOrderLineItem_line_total_check', 'InventoryStock_total_cost_check', 'Deal_nonnegative_check']) {
    assert.match(sql, new RegExp(`"${name}"`));
  }
});
