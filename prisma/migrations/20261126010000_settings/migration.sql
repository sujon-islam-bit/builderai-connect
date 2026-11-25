-- Owner setup: tiny key-value settings table. The first-run setup page
-- stores owner_email + owner_password_hash (bcrypt) here when the owner
-- password is set through the site instead of via env.
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);
