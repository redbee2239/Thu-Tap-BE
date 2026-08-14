CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

UPDATE "User"
SET "role" = 'ADMIN'
WHERE "id" IN (SELECT "ownerId" FROM "Workspace");
