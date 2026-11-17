// Parts held for one repair order are used up or released only by that order.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const src = fs.readFileSync(path.resolve(__dirname, '../features/keystone/mutations/partsOperations.ts'), 'utf8');
const start = src.indexOf('export function computePartsMovement');
const end = src.indexOf('\n}\n', start) + 2;
const out = ts.transpileModule(src.slice(start, end), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', out)(mod, mod.exports);
const { computePartsMovement } = mod.exports;

test('issuing on an order that held nothing leaves another order\'s hold in place', () => {
  const after = computePartsMovement({ quantity: 5, committedQuantity: 2, onOrderQuantity: 0 }, 'issue', 1, undefined, 0);
  assert.deepEqual([after.onHand, after.committed], [4, 2]);
});

test('issuing on the order that held the part uses its hold', () => {
  const after = computePartsMovement({ quantity: 5, committedQuantity: 2, onOrderQuantity: 0 }, 'issue', 2, undefined, 2);
  assert.deepEqual([after.onHand, after.committed], [3, 0]);
});

test('an order cannot release more than it holds', () => {
  assert.throws(() => computePartsMovement({ quantity: 5, committedQuantity: 2, onOrderQuantity: 0 }, 'release', 2, undefined, 0), /Only 0 held/);
  const after = computePartsMovement({ quantity: 5, committedQuantity: 2, onOrderQuantity: 0 }, 'release', 2, undefined, 2);
  assert.equal(after.committed, 0);
});
