-- AlterTable
ALTER TABLE "MetaEntity" ADD COLUMN "handler" TEXT;
ALTER TABLE "MetaEntity" ADD COLUMN "routePrefix" TEXT DEFAULT '/doc';
ALTER TABLE "MetaEntity" ADD COLUMN "capabilities" TEXT;

-- CreateTable
CREATE TABLE "MetaLineDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT 'lines',
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MetaLineDefinition_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "MetaEntity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetaLineColumn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lineDefId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "systemField" TEXT,
    "refEntityCode" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "listVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MetaLineColumn_lineDefId_fkey" FOREIGN KEY ("lineDefId") REFERENCES "MetaLineDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaLineDefinition_entityId_code_key" ON "MetaLineDefinition"("entityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MetaLineColumn_lineDefId_code_key" ON "MetaLineColumn"("lineDefId", "code");
