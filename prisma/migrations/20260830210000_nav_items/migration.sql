-- CreateTable
CREATE TABLE "NavItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL DEFAULT 'grid',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "activePrefixes" TEXT,
    "metaEntityCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "NavItem_code_key" ON "NavItem"("code");

-- CreateIndex
CREATE INDEX "NavItem_isActive_sortOrder_idx" ON "NavItem"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "NavItem_metaEntityCode_idx" ON "NavItem"("metaEntityCode");
