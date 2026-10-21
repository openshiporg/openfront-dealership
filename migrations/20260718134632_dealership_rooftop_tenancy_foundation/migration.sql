-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "canManageDealerships" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DealerGroup" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "legalName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "DealerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rooftop" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rooftopKey" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "publicSlug" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "dealerGroup" TEXT,

    CONSTRAINT "Rooftop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerGroupMembership" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "membershipKey" TEXT NOT NULL DEFAULT '',
    "user" TEXT,
    "dealerGroup" TEXT,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "accessAllRooftops" BOOLEAN NOT NULL DEFAULT false,
    "invitedBy" TEXT,
    "joinedAt" TIMESTAMP(3),

    CONSTRAINT "DealerGroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RooftopMembership" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "membershipKey" TEXT NOT NULL DEFAULT '',
    "user" TEXT,
    "rooftop" TEXT,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "invitedBy" TEXT,
    "joinedAt" TIMESTAMP(3),

    CONSTRAINT "RooftopMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealerGroup_slug_key" ON "DealerGroup"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Rooftop_rooftopKey_key" ON "Rooftop"("rooftopKey");

-- CreateIndex
CREATE UNIQUE INDEX "Rooftop_publicSlug_key" ON "Rooftop"("publicSlug");

-- CreateIndex
CREATE INDEX "Rooftop_dealerGroup_idx" ON "Rooftop"("dealerGroup");

-- CreateIndex
CREATE UNIQUE INDEX "DealerGroupMembership_membershipKey_key" ON "DealerGroupMembership"("membershipKey");

-- CreateIndex
CREATE INDEX "DealerGroupMembership_user_idx" ON "DealerGroupMembership"("user");

-- CreateIndex
CREATE INDEX "DealerGroupMembership_dealerGroup_idx" ON "DealerGroupMembership"("dealerGroup");

-- CreateIndex
CREATE INDEX "DealerGroupMembership_role_idx" ON "DealerGroupMembership"("role");

-- CreateIndex
CREATE INDEX "DealerGroupMembership_invitedBy_idx" ON "DealerGroupMembership"("invitedBy");

-- CreateIndex
CREATE UNIQUE INDEX "RooftopMembership_membershipKey_key" ON "RooftopMembership"("membershipKey");

-- CreateIndex
CREATE INDEX "RooftopMembership_user_idx" ON "RooftopMembership"("user");

-- CreateIndex
CREATE INDEX "RooftopMembership_rooftop_idx" ON "RooftopMembership"("rooftop");

-- CreateIndex
CREATE INDEX "RooftopMembership_role_idx" ON "RooftopMembership"("role");

-- CreateIndex
CREATE INDEX "RooftopMembership_invitedBy_idx" ON "RooftopMembership"("invitedBy");

-- AddForeignKey
ALTER TABLE "Rooftop" ADD CONSTRAINT "Rooftop_dealerGroup_fkey" FOREIGN KEY ("dealerGroup") REFERENCES "DealerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerGroupMembership" ADD CONSTRAINT "DealerGroupMembership_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerGroupMembership" ADD CONSTRAINT "DealerGroupMembership_dealerGroup_fkey" FOREIGN KEY ("dealerGroup") REFERENCES "DealerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerGroupMembership" ADD CONSTRAINT "DealerGroupMembership_role_fkey" FOREIGN KEY ("role") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerGroupMembership" ADD CONSTRAINT "DealerGroupMembership_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RooftopMembership" ADD CONSTRAINT "RooftopMembership_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RooftopMembership" ADD CONSTRAINT "RooftopMembership_rooftop_fkey" FOREIGN KEY ("rooftop") REFERENCES "Rooftop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RooftopMembership" ADD CONSTRAINT "RooftopMembership_role_fkey" FOREIGN KEY ("role") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RooftopMembership" ADD CONSTRAINT "RooftopMembership_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
