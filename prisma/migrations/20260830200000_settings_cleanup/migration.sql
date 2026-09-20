-- Align Settings with current schema (drop deprecated moduleControl, update defaults)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "warehouseName" TEXT NOT NULL DEFAULT 'Склад',
    "warehouseCode" TEXT NOT NULL DEFAULT 'WH-01',
    "defaultReceivingLocId" TEXT,
    "defaultShippingLocId" TEXT,
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "tsdApiKey" TEXT NOT NULL DEFAULT '',
    "topologyWidth" INTEGER NOT NULL DEFAULT 1200,
    "topologyHeight" INTEGER NOT NULL DEFAULT 800,
    "moduleInbound" BOOLEAN NOT NULL DEFAULT true,
    "moduleOutbound" BOOLEAN NOT NULL DEFAULT true,
    "moduleTopology" BOOLEAN NOT NULL DEFAULT true,
    "moduleLots" BOOLEAN NOT NULL DEFAULT true,
    "putawayAllowOverride" BOOLEAN NOT NULL DEFAULT true,
    "tsdShowPutawayAfterReceive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_Settings" (
    "id", "warehouseName", "warehouseCode", "defaultReceivingLocId", "defaultShippingLocId",
    "allowNegativeStock", "tsdApiKey", "topologyWidth", "topologyHeight",
    "moduleInbound", "moduleOutbound", "moduleTopology", "moduleLots",
    "putawayAllowOverride", "tsdShowPutawayAfterReceive", "createdAt", "updatedAt"
)
SELECT
    "id", "warehouseName", "warehouseCode", "defaultReceivingLocId", "defaultShippingLocId",
    "allowNegativeStock",
    CASE WHEN "tsdApiKey" = 'tsd-demo-key' THEN '' ELSE "tsdApiKey" END,
    "topologyWidth", "topologyHeight",
    "moduleInbound", "moduleOutbound", "moduleTopology", "moduleLots",
    "putawayAllowOverride", "tsdShowPutawayAfterReceive", "createdAt", "updatedAt"
FROM "Settings";

DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
