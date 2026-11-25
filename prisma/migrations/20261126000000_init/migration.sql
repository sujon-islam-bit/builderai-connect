-- Connect service slice 1: the Connection table (one linked external
-- account per row; OAuth tokens AES-256-GCM encrypted in "data").
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "accountEmail" TEXT,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Connection_provider_externalUserId_idx" ON "Connection"("provider", "externalUserId");
