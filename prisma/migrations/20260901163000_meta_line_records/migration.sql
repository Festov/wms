-- CreateTable
CREATE TABLE "MetaLineRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "lineDefId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 0,
    "dataJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MetaLineRecord_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MetaRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetaLineRecord_lineDefId_fkey" FOREIGN KEY ("lineDefId") REFERENCES "MetaLineDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MetaLineRecord_recordId_lineDefId_idx" ON "MetaLineRecord"("recordId", "lineDefId");
