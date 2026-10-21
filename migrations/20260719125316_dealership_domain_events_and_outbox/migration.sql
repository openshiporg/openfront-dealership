-- CreateTable
CREATE TABLE "DomainAuditEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "requestHash" TEXT NOT NULL DEFAULT '',
    "aggregateType" TEXT NOT NULL DEFAULT '',
    "aggregateId" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT '',
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "metadata" JSONB DEFAULT '{}',
    "actor" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainOutboxEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftop" TEXT NOT NULL,
    "deliveryKey" TEXT NOT NULL DEFAULT '',
    "topic" TEXT NOT NULL DEFAULT '',
    "aggregateType" TEXT NOT NULL DEFAULT '',
    "aggregateId" TEXT NOT NULL DEFAULT '',
    "payload" JSONB DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "DomainOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainAuditEvent_eventKey_key" ON "DomainAuditEvent"("eventKey");
CREATE INDEX "DomainAuditEvent_aggregateType_idx" ON "DomainAuditEvent"("aggregateType");
CREATE INDEX "DomainAuditEvent_aggregateId_idx" ON "DomainAuditEvent"("aggregateId");
CREATE INDEX "DomainAuditEvent_occurredAt_idx" ON "DomainAuditEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "DomainAuditEvent_rooftop_idx" ON "DomainAuditEvent"("rooftop");

-- CreateIndex
CREATE INDEX "DomainAuditEvent_actor_idx" ON "DomainAuditEvent"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "DomainOutboxEvent_deliveryKey_key" ON "DomainOutboxEvent"("deliveryKey");
CREATE INDEX "DomainOutboxEvent_topic_idx" ON "DomainOutboxEvent"("topic");
CREATE INDEX "DomainOutboxEvent_aggregateType_idx" ON "DomainOutboxEvent"("aggregateType");
CREATE INDEX "DomainOutboxEvent_status_idx" ON "DomainOutboxEvent"("status");
CREATE INDEX "DomainOutboxEvent_availableAt_idx" ON "DomainOutboxEvent"("availableAt");

-- CreateIndex
CREATE INDEX "DomainOutboxEvent_rooftop_idx" ON "DomainOutboxEvent"("rooftop");

-- AddForeignKey
ALTER TABLE "DomainAuditEvent" ADD CONSTRAINT "DomainAuditEvent_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainAuditEvent" ADD CONSTRAINT "DomainAuditEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainOutboxEvent" ADD CONSTRAINT "DomainOutboxEvent_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
