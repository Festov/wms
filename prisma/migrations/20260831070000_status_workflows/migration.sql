-- CreateTable
CREATE TABLE "StatusWorkflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityCode" TEXT,
    "appliesTo" TEXT NOT NULL DEFAULT 'document',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StatusTransition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "fromStatusCode" TEXT,
    "toStatusCode" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "guardConfig" TEXT,
    CONSTRAINT "StatusTransition_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "StatusWorkflow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusTrigger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transitionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "config" TEXT,
    "requiredPerm" TEXT,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StatusTrigger_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "StatusTransition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StatusWorkflow_code_key" ON "StatusWorkflow"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StatusTransition_workflowId_fromStatusCode_toStatusCode_key" ON "StatusTransition"("workflowId", "fromStatusCode", "toStatusCode");

-- CreateIndex
CREATE INDEX "StatusTransition_workflowId_idx" ON "StatusTransition"("workflowId");

-- CreateIndex
CREATE INDEX "StatusTrigger_transitionId_idx" ON "StatusTrigger"("transitionId");
