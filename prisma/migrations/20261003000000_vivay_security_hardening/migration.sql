-- Additive, non-destructive migration. Back up production before running.
ALTER TABLE "User" ALTER COLUMN "cccd" SET DEFAULT '';
ALTER TABLE "User" ADD COLUMN "loanCode" TEXT;
ALTER TABLE "User" ADD COLUMN "loanStatus" TEXT NOT NULL DEFAULT 'Đang xử lý';
ALTER TABLE "User" ADD COLUMN "feeOrInterestDisplay" TEXT;
ALTER TABLE "User" ADD COLUMN "paymentAccountName" TEXT;
ALTER TABLE "User" ADD COLUMN "paymentBank" TEXT;
ALTER TABLE "User" ADD COLUMN "paymentAccountNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "accessTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "accessTokenLastRotatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Admin" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Admin" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE "Admin" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Admin" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "entityId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_loanCode_key" ON "User"("loanCode");
CREATE INDEX "AuditLog_entityId_createdAt_idx" ON "AuditLog"("entityId", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
