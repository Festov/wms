ALTER TABLE "Role" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Role" SET "isSystem" = true WHERE "code" IN ('admin', 'operator', 'storekeeper', 'viewer');
