-- AlterTable: Make approverId optional in Approval, add stepOrder and idempotencyKey
ALTER TABLE "Approval" ALTER COLUMN "approverId" DROP NOT NULL;
ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "stepOrder" INTEGER;
ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Approval_idempotencyKey_key" ON "Approval"("idempotencyKey");

-- AlterTable: Add eventType, stepOrder, and idempotencyKey to Notification
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "eventType" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "stepOrder" INTEGER;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_idempotencyKey_key" ON "Notification"("idempotencyKey");
