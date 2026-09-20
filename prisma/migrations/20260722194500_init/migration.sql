-- CreateTable
CREATE TABLE "Status" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "forInbound" BOOLEAN NOT NULL DEFAULT false,
    "forOutbound" BOOLEAN NOT NULL DEFAULT false,
    "forPutaway" BOOLEAN NOT NULL DEFAULT false,
    "forPallet" BOOLEAN NOT NULL DEFAULT false,
    "forTransfer" BOOLEAN NOT NULL DEFAULT false,
    "colorBg" TEXT,
    "colorFg" TEXT,
    "colorBorder" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AccountingModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "useLots" BOOLEAN NOT NULL DEFAULT false,
    "useExpiry" BOOLEAN NOT NULL DEFAULT false,
    "useSerial" BOOLEAN NOT NULL DEFAULT false,
    "lotNameTemplate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Settings" (
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

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "factor" REAL NOT NULL DEFAULT 1,
    "lengthMm" REAL,
    "widthMm" REAL,
    "heightMm" REAL,
    "weightNetKg" REAL,
    "weightGrossKg" REAL,
    "volumeM3" REAL,
    "barcode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Package_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Package_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Counterparty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BOTH',
    "inn" TEXT,
    "kpp" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'STORAGE',
    "color" TEXT NOT NULL DEFAULT '#0b6e4f',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PalletType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "barcodeTemplate" TEXT,
    "lengthMm" REAL,
    "widthMm" REAL,
    "heightMm" REAL,
    "maxWeightKg" REAL,
    "weightOwnKg" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Pallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "barcode" TEXT,
    "palletTypeId" TEXT NOT NULL,
    "locationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pallet_palletTypeId_fkey" FOREIGN KEY ("palletTypeId") REFERENCES "PalletType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pallet_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "description" TEXT,
    "unitId" TEXT,
    "lengthMm" REAL,
    "widthMm" REAL,
    "heightMm" REAL,
    "weightNetKg" REAL,
    "weightGrossKg" REAL,
    "volumeM3" REAL,
    "minStock" REAL NOT NULL DEFAULT 0,
    "trackLots" BOOLEAN NOT NULL DEFAULT false,
    "trackExpiry" BOOLEAN NOT NULL DEFAULT false,
    "shelfLifeDays" INTEGER,
    "shelfLifeUnit" TEXT NOT NULL DEFAULT 'DAY',
    "accountingModelId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_accountingModelId_fkey" FOREIGN KEY ("accountingModelId") REFERENCES "AccountingModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zoneId" TEXT,
    "aisle" TEXT,
    "rack" TEXT,
    "level" TEXT,
    "position" TEXT,
    "type" TEXT NOT NULL DEFAULT 'STORAGE',
    "palletTypeId" TEXT,
    "barcode" TEXT,
    "lengthMm" REAL,
    "widthMm" REAL,
    "heightMm" REAL,
    "maxWeightKg" REAL,
    "mapX" REAL NOT NULL DEFAULT 40,
    "mapY" REAL NOT NULL DEFAULT 40,
    "mapW" REAL NOT NULL DEFAULT 80,
    "mapH" REAL NOT NULL DEFAULT 48,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Location_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Location_palletTypeId_fkey" FOREIGN KEY ("palletTypeId") REFERENCES "PalletType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "expiryDate" DATETIME,
    "manufacturedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "lotId" TEXT,
    "lotKey" TEXT NOT NULL DEFAULT '',
    "palletId" TEXT,
    "palletKey" TEXT NOT NULL DEFAULT '',
    "packageId" TEXT,
    "packageKey" TEXT NOT NULL DEFAULT '',
    "quantity" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "StockBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockBalance_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockBalance_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "Pallet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockBalance_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReceivingDock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zoneId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'FREE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReceivingDock_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "carrierName" TEXT,
    "driverName" TEXT NOT NULL,
    "driverPhone" TEXT,
    "driverLicense" TEXT,
    "passport" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InboundDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "supplier" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'PLANNED',
    "purchaseOrderRef" TEXT,
    "waybillRef" TEXT,
    "externalRef" TEXT,
    "expectedDate" DATETIME,
    "actualArrivalAt" DATETIME,
    "receivingDockId" TEXT,
    "transportUnitId" TEXT,
    "responsibleUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "postedAt" DATETIME,
    CONSTRAINT "InboundDocument_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InboundDocument_receivingDockId_fkey" FOREIGN KEY ("receivingDockId") REFERENCES "ReceivingDock" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InboundDocument_transportUnitId_fkey" FOREIGN KEY ("transportUnitId") REFERENCES "TransportUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboundStatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,
    "source" TEXT,
    "note" TEXT,
    CONSTRAINT "InboundStatusHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "InboundDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InboundStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboundLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "packageId" TEXT,
    "packageQty" REAL,
    "locationId" TEXT,
    "palletId" TEXT,
    "lotId" TEXT,
    "lotNumber" TEXT,
    "expiryDate" DATETIME,
    "quantity" REAL NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "InboundLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "InboundDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InboundLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InboundLine_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InboundLine_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InboundLine_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "Pallet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InboundLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutboundDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "customer" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'PLANNED',
    "salesOrderRef" TEXT,
    "waybillRef" TEXT,
    "externalRef" TEXT,
    "shipDate" DATETIME,
    "actualShipmentAt" DATETIME,
    "receivingDockId" TEXT,
    "transportUnitId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "postedAt" DATETIME,
    CONSTRAINT "OutboundDocument_receivingDockId_fkey" FOREIGN KEY ("receivingDockId") REFERENCES "ReceivingDock" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutboundDocument_transportUnitId_fkey" FOREIGN KEY ("transportUnitId") REFERENCES "TransportUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutboundStatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,
    "source" TEXT,
    "note" TEXT,
    CONSTRAINT "OutboundStatusHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "OutboundDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutboundStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutboundLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "packageId" TEXT,
    "packageQty" REAL,
    "lotId" TEXT,
    "quantity" REAL NOT NULL,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "OutboundLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "OutboundDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutboundLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutboundLine_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutboundLine_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutboundLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT,
    "palletId" TEXT,
    "packageId" TEXT,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "quantity" REAL NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "Pallet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("roleId", "code"),
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "roleId"),
    CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NavIconOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "MetaEntity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pluralName" TEXT,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'catalog',
    "storage" TEXT NOT NULL DEFAULT 'system',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MetaFormSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MetaFormSection_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "MetaEntity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetaAttribute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "unique" BOOLEAN NOT NULL DEFAULT false,
    "refEntityCode" TEXT,
    "enumValues" TEXT,
    "sectionId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "systemField" TEXT,
    "listVisible" BOOLEAN NOT NULL DEFAULT true,
    "formVisible" BOOLEAN NOT NULL DEFAULT true,
    "widget" TEXT,
    CONSTRAINT "MetaAttribute_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "MetaEntity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetaAttribute_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "MetaFormSection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetaRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "code" TEXT,
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MetaRecord_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "MetaEntity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetaValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" REAL,
    "valueBool" BOOLEAN,
    "valueDate" DATETIME,
    "valueJson" TEXT,
    CONSTRAINT "MetaValue_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MetaRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetaValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "MetaAttribute" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TsdDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "lastSeenAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TsdDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TsdTaskSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "userId" TEXT,
    "deviceId" TEXT,
    "documentId" TEXT,
    "palletId" TEXT,
    "locationId" TEXT,
    "plannedLocId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    CONSTRAINT "TsdTaskSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TsdTaskSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "TsdDevice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TsdTaskSession_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "Pallet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperationDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "createdByUserId" TEXT,
    "inboundDocumentId" TEXT,
    "palletId" TEXT,
    "sessionId" TEXT,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "postedAt" DATETIME,
    CONSTRAINT "OperationDocument_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OperationDocument_inboundDocumentId_fkey" FOREIGN KEY ("inboundDocumentId") REFERENCES "InboundDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OperationDocument_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "Pallet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OperationDocument_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OperationDocument_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperationLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "packageId" TEXT,
    "lotId" TEXT,
    "palletId" TEXT,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "quantity" REAL NOT NULL,
    "packageQty" REAL,
    "note" TEXT,
    "lineNo" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "OperationLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "OperationDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OperationLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OperationLine_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OperationLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OperationLine_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "Pallet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OperationLine_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OperationLine_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PutawayRuleSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "paramsJson" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IntegrationOutbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

-- CreateTable
CREATE TABLE "IntegrationInbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

-- CreateTable
CREATE TABLE "IntegrationEndpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'webhook',
    "url" TEXT,
    "secret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IntegrationApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Status_code_key" ON "Status"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingModel_code_key" ON "AccountingModel"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Package_code_key" ON "Package"("code");

-- CreateIndex
CREATE INDEX "Package_productId_idx" ON "Package"("productId");

-- CreateIndex
CREATE INDEX "Package_barcode_idx" ON "Package"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Counterparty_code_key" ON "Counterparty"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_code_key" ON "Zone"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PalletType_code_key" ON "PalletType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Pallet_code_key" ON "Pallet"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateIndex
CREATE INDEX "Lot_expiryDate_idx" ON "Lot"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_productId_number_key" ON "Lot"("productId", "number");

-- CreateIndex
CREATE INDEX "StockBalance_locationId_idx" ON "StockBalance"("locationId");

-- CreateIndex
CREATE INDEX "StockBalance_lotId_idx" ON "StockBalance"("lotId");

-- CreateIndex
CREATE INDEX "StockBalance_palletId_idx" ON "StockBalance"("palletId");

-- CreateIndex
CREATE INDEX "StockBalance_packageId_idx" ON "StockBalance"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_productId_locationId_lotKey_palletKey_packageKey_key" ON "StockBalance"("productId", "locationId", "lotKey", "palletKey", "packageKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReceivingDock_code_key" ON "ReceivingDock"("code");

-- CreateIndex
CREATE INDEX "ReceivingDock_status_idx" ON "ReceivingDock"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TransportUnit_code_key" ON "TransportUnit"("code");

-- CreateIndex
CREATE INDEX "TransportUnit_plateNumber_idx" ON "TransportUnit"("plateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InboundDocument_number_key" ON "InboundDocument"("number");

-- CreateIndex
CREATE INDEX "InboundDocument_kind_idx" ON "InboundDocument"("kind");

-- CreateIndex
CREATE INDEX "InboundDocument_purchaseOrderRef_idx" ON "InboundDocument"("purchaseOrderRef");

-- CreateIndex
CREATE INDEX "InboundDocument_waybillRef_idx" ON "InboundDocument"("waybillRef");

-- CreateIndex
CREATE INDEX "InboundDocument_receivingDockId_idx" ON "InboundDocument"("receivingDockId");

-- CreateIndex
CREATE INDEX "InboundDocument_transportUnitId_idx" ON "InboundDocument"("transportUnitId");

-- CreateIndex
CREATE INDEX "InboundStatusHistory_documentId_changedAt_idx" ON "InboundStatusHistory"("documentId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundDocument_number_key" ON "OutboundDocument"("number");

-- CreateIndex
CREATE INDEX "OutboundDocument_kind_idx" ON "OutboundDocument"("kind");

-- CreateIndex
CREATE INDEX "OutboundDocument_salesOrderRef_idx" ON "OutboundDocument"("salesOrderRef");

-- CreateIndex
CREATE INDEX "OutboundDocument_waybillRef_idx" ON "OutboundDocument"("waybillRef");

-- CreateIndex
CREATE INDEX "OutboundDocument_receivingDockId_idx" ON "OutboundDocument"("receivingDockId");

-- CreateIndex
CREATE INDEX "OutboundDocument_transportUnitId_idx" ON "OutboundDocument"("transportUnitId");

-- CreateIndex
CREATE INDEX "OutboundStatusHistory_documentId_changedAt_idx" ON "OutboundStatusHistory"("documentId", "changedAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_palletId_idx" ON "StockMovement"("palletId");

-- CreateIndex
CREATE INDEX "StockMovement_packageId_idx" ON "StockMovement"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "NavIconOverride_code_key" ON "NavIconOverride"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MetaEntity_code_key" ON "MetaEntity"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MetaFormSection_entityId_code_key" ON "MetaFormSection"("entityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAttribute_entityId_code_key" ON "MetaAttribute"("entityId", "code");

-- CreateIndex
CREATE INDEX "MetaRecord_entityId_idx" ON "MetaRecord"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaRecord_entityId_code_key" ON "MetaRecord"("entityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MetaValue_recordId_attributeId_key" ON "MetaValue"("recordId", "attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "TsdDevice_deviceKey_key" ON "TsdDevice"("deviceKey");

-- CreateIndex
CREATE INDEX "TsdTaskSession_type_status_idx" ON "TsdTaskSession"("type", "status");

-- CreateIndex
CREATE INDEX "TsdTaskSession_documentId_idx" ON "TsdTaskSession"("documentId");

-- CreateIndex
CREATE INDEX "TsdTaskSession_palletId_idx" ON "TsdTaskSession"("palletId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationDocument_number_key" ON "OperationDocument"("number");

-- CreateIndex
CREATE INDEX "OperationDocument_type_createdAt_idx" ON "OperationDocument"("type", "createdAt");

-- CreateIndex
CREATE INDEX "OperationDocument_inboundDocumentId_idx" ON "OperationDocument"("inboundDocumentId");

-- CreateIndex
CREATE INDEX "OperationDocument_palletId_idx" ON "OperationDocument"("palletId");

-- CreateIndex
CREATE INDEX "OperationLine_documentId_idx" ON "OperationLine"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "PutawayRuleSetting_code_key" ON "PutawayRuleSetting"("code");

-- CreateIndex
CREATE INDEX "IntegrationOutbox_status_createdAt_idx" ON "IntegrationOutbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationInbox_status_createdAt_idx" ON "IntegrationInbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationInbox_source_externalId_idx" ON "IntegrationInbox"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationEndpoint_code_key" ON "IntegrationEndpoint"("code");
