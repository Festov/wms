"use server";

import { throwLocalized } from "@/lib/i18n/errors-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  bumpStock,
  calcManufacturedAt,
  nextDocNumber,
  parseOptionalDate,
} from "@/lib/stock";
import { requireModuleWrite, requireUser, getModuleFlags } from "@/lib/session";
import { enqueueOutbox } from "@/lib/integration/outbox";
import { saveDocumentExtraFromForm } from "@/lib/meta/document-form";
import {
  validateInboundCreateMeta,
  validateOutboundCreateMeta,
} from "@/lib/meta/document-form-actions";
import { inboundStatusOptions } from "@/lib/inbound-status";
import { recordInboundStatusChange } from "@/lib/inbound-status-history";
import { outboundStatusOptions } from "@/lib/outbound-status";
import { recordOutboundStatusChange } from "@/lib/outbound-status-history";
import { isTransitionAllowed } from "@/lib/workflow/engine";
import { requireEntityPermission } from "@/lib/permissions/check";
import { parseInboundKind } from "@/lib/inbound-document";
import { parseOutboundKind } from "@/lib/outbound-document";
import {
  assertReceivingDockAssignable,
  syncReceivingDockStatus,
  syncOutboundDocumentDock,
} from "@/lib/receiving-dock";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string) {
  const raw = str(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/* ─── Inbound ─── */

export async function createInboundDocument(formData: FormData) {
  await requireModuleWrite("inbound");
  const user = await requireUser();
  const flags = await getModuleFlags();

  await validateInboundCreateMeta(formData);

  const supplierId = str(formData, "supplierId");
  if (!supplierId) return throwLocalized("errors.documents.supplierRequired");

  const supplier = await prisma.counterparty.findFirst({
    where: {
      id: supplierId,
      isActive: true,
      OR: [{ kind: "SUPPLIER" }, { kind: "BOTH" }],
    },
  });
  if (!supplier) return throwLocalized("errors.documents.supplierNotFound");

  const expectedDate = parseOptionalDate(formData.get("expectedDate"));
  if (!expectedDate) {
    return throwLocalized("errors.documents.expectedDateRequired");
  }

  const productIds = formData.getAll("lineProductId").map((v) => String(v).trim());
  const quantities = formData.getAll("lineQuantity").map((v) => String(v).trim());
  const packageIds = formData.getAll("linePackageId").map((v) => String(v).trim());
  const lotIds = flags.lots
    ? formData.getAll("lineLotId").map((v) => String(v).trim())
    : [];

  if (productIds.length === 0) {
    return throwLocalized("errors.documents.addAtLeastOneLine");
  }

  const lines: Array<{
    productId: string;
    packageId: string | null;
    packageQty: number | null;
    quantity: number;
    lotId: string | null;
    lotNumber: string | null;
  }> = [];

  for (let i = 0; i < productIds.length; i++) {
    const productId = productIds[i];
    const enteredQty = Number(quantities[i]);
    if (!productId || !Number.isFinite(enteredQty) || enteredQty <= 0) {
      return throwLocalized("errors.documents.lineProductQty", { line: i + 1 });
    }

    const packageIdRaw = packageIds[i] || "";
    let packageId: string | null = null;
    let packageQty: number | null = null;
    let quantity = enteredQty;

    if (!packageIdRaw) {
      return throwLocalized("errors.documents.lineSelectPackage", { line: i + 1 });
    }
    const pkg = await prisma.package.findFirst({
      where: { id: packageIdRaw, productId, isActive: true },
    });
    if (!pkg) {
      return throwLocalized("errors.documents.lineSelectPackageForProduct", {
        line: i + 1,
      });
    }
    packageId = pkg.id;
    packageQty = enteredQty;
    quantity = enteredQty * pkg.factor;

    let lotId: string | null = null;
    let lotNumber: string | null = null;
    const lotIdRaw = flags.lots ? lotIds[i] || "" : "";
    if (lotIdRaw) {
      const lot = await prisma.lot.findUnique({ where: { id: lotIdRaw } });
      if (!lot || lot.productId !== productId) {
        return throwLocalized("errors.documents.lineSelectLot", { line: i + 1 });
      }
      lotId = lot.id;
      lotNumber = lot.number;
    }

    lines.push({
      productId,
      packageId,
      packageQty,
      quantity,
      lotId,
      lotNumber,
    });
  }

  const number = (await nextDocNumber("IN")) as string;
  const receivingDockId = str(formData, "receivingDockId") || null;
  const transportUnitId = str(formData, "transportUnitId") || null;
  if (receivingDockId) {
    await assertReceivingDockAssignable(receivingDockId);
  }

  const doc = await prisma.inboundDocument.create({
    data: {
      number,
      supplier: supplier.name,
      kind: parseInboundKind(str(formData, "kind")),
      purchaseOrderRef: str(formData, "purchaseOrderRef") || null,
      waybillRef: str(formData, "waybillRef") || null,
      externalRef: str(formData, "externalRef") || null,
      expectedDate,
      actualArrivalAt: parseOptionalDate(formData.get("actualArrivalAt")),
      receivingDockId,
      transportUnitId,
      notes: str(formData, "notes") || null,
      lines: {
        create: lines.map((line, index) => ({
          productId: line.productId,
          packageId: line.packageId,
          packageQty: line.packageQty,
          quantity: line.quantity,
          lotId: line.lotId,
          lotNumber: line.lotNumber,
          lineNo: index + 1,
        })),
      },
    },
  });

  await saveDocumentExtraFromForm("inbound", doc.id, formData, doc.number);

  await recordInboundStatusChange(prisma, {
    documentId: doc.id,
    fromStatus: null,
    toStatus: "DRAFT",
    changedById: user.id,
    source: "web",
    note: "Создание документа",
  });

  revalidatePath("/doc/inbound");
  revalidatePath("/inbound");
  redirect(`/doc/inbound/${doc.id}`);
}

export async function addInboundLine(documentId: string, formData: FormData) {
  await requireModuleWrite("inbound");
  const flags = await getModuleFlags();
  const doc = await prisma.inboundDocument.findUniqueOrThrow({
    where: { id: documentId },
  });
  if (doc.status !== "DRAFT") {
    return throwLocalized("errors.documents.linesOnlyInDraft");
  }

  const productId = str(formData, "productId");
  const locationId = str(formData, "locationId") || null;
  const enteredQty = num(formData, "quantity") ?? 0;
  if (!productId || enteredQty <= 0) {
    return throwLocalized("errors.documents.fillProductQty");
  }

  const packageIdRaw = str(formData, "packageId") || null;
  let packageId: string | null = null;
  let packageQty: number | null = null;
  let quantity = enteredQty;
  if (!packageIdRaw) {
    return throwLocalized("errors.documents.selectPackage");
  }
  const pkg = await prisma.package.findFirst({
    where: { id: packageIdRaw, productId, isActive: true },
  });
  if (!pkg) {
    return throwLocalized("errors.documents.selectPackageForProduct");
  }
  packageId = pkg.id;
  packageQty = enteredQty;
  quantity = enteredQty * pkg.factor;

  const lotIdRaw = flags.lots ? str(formData, "lotId") || null : null;
  let lotId: string | null = null;
  let lotNumber: string | null = null;
  let expiryDate: Date | null = null;
  if (lotIdRaw) {
    const lot = await prisma.lot.findUnique({ where: { id: lotIdRaw } });
    if (!lot || lot.productId !== productId) {
      return throwLocalized("errors.documents.selectLotForProduct");
    }
    lotId = lot.id;
    lotNumber = lot.number;
    expiryDate = lot.expiryDate;
  }
  const lineCount = await prisma.inboundLine.count({ where: { documentId } });

  await prisma.inboundLine.create({
    data: {
      documentId,
      productId,
      packageId,
      packageQty,
      locationId,
      quantity,
      lotId,
      lotNumber,
      expiryDate,
      lineNo: lineCount + 1,
    },
  });
  revalidatePath(`/doc/inbound/${documentId}`);
  redirect(`/doc/inbound/${documentId}`);
}

export async function executeDocumentTransition(formData: FormData) {
  const entityCode = str(formData, "entityCode");
  const documentId = str(formData, "documentId");
  const toStatusCode = str(formData, "toStatusCode");
  if (!entityCode || !documentId || !toStatusCode) {
    return throwLocalized("errors.documents.documentAndStatusRequired");
  }

  const payload = new FormData();
  payload.set("documentId", documentId);
  payload.set("status", toStatusCode);

  if (entityCode === "inbound") {
    await updateInboundDocumentStatus(payload);
    return;
  }
  if (entityCode === "outbound") {
    await updateOutboundDocumentStatus(payload);
    return;
  }
  if (entityCode === "operation") {
    await updateOperationDocumentStatus(payload);
    return;
  }

  return throwLocalized("errors.documents.statusTransitionNotSupported");
}

export async function updateInboundDocumentStatus(formData: FormData) {
  await requireEntityPermission("inbound", "write");
  const user = await requireUser();
  const documentId = str(formData, "documentId");
  const nextStatus = str(formData, "status");
  if (!documentId || !nextStatus) {
    return throwLocalized("errors.documents.documentAndStatusRequired");
  }

  const doc = await prisma.inboundDocument.findUniqueOrThrow({
    where: { id: documentId },
    include: { _count: { select: { lines: true } } },
  });

  const allowed = await inboundStatusOptions(doc.status, {
    documentId,
    lineCount: doc._count.lines,
  });
  if (!allowed.includes(nextStatus)) {
    const workflowAllowed = await isTransitionAllowed(
      "inbound",
      doc.status,
      nextStatus,
      "manual",
      { documentId, lineCount: doc._count.lines, entityCode: "inbound" },
    );
    if (!workflowAllowed) {
      return throwLocalized("errors.documents.statusTransitionUnavailable");
    }
  }
  if (nextStatus === doc.status) return;

  if (nextStatus === "RELEASED" && doc._count.lines === 0) {
    return throwLocalized("errors.documents.addLineBeforeRelease");
  }

  const fromStatus = doc.status;
  let resolvedStatus = nextStatus;

  if (nextStatus === "PLACED" || nextStatus === "COMPLETED") {
    const { assertInboundReadyToPlace } = await import("@/lib/inbound-place");
    await assertInboundReadyToPlace(documentId);
    resolvedStatus = "PLACED";
  }

  await prisma.$transaction(async (tx) => {
    await tx.inboundDocument.update({
      where: { id: documentId },
      data: {
        status: resolvedStatus as
          | "DRAFT"
          | "RELEASED"
          | "CANCELLED"
          | "ACCEPTED"
          | "PLACED"
          | "POSTED",
      },
    });
    await recordInboundStatusChange(tx, {
      documentId,
      fromStatus,
      toStatus: resolvedStatus,
      changedById: user.id,
      source: "web",
    });
  });

  if (resolvedStatus === "PLACED") {
    await enqueueOutbox({
      eventType: "inbound.placed",
      aggregateType: "InboundDocument",
      aggregateId: doc.id,
      payload: { id: doc.id, number: doc.number, status: "PLACED" },
    });
  }

  revalidatePath("/doc/inbound");
  revalidatePath("/inbound");
  revalidatePath(`/doc/inbound/${documentId}`);

  const updated = await prisma.inboundDocument.findUnique({
    where: { id: documentId },
    select: { receivingDockId: true },
  });
  await syncReceivingDockStatus(updated?.receivingDockId);
  revalidatePath("/catalog/receiving_docks");
}

/* ─── Outbound ─── */

async function resolveOutboundCustomer(customerId: string | null) {
  if (!customerId) return null;
  const customer = await prisma.counterparty.findFirst({
    where: {
      id: customerId,
      isActive: true,
      OR: [{ kind: "CUSTOMER" }, { kind: "BOTH" }],
    },
  });
  if (!customer) return throwLocalized("errors.documents.customerNotFound");
  return customer.name;
}

export async function createOutboundDocument(formData: FormData) {
  await requireModuleWrite("outbound");
  const user = await requireUser();
  const flags = await getModuleFlags();

  await validateOutboundCreateMeta(formData);

  const customerId = str(formData, "customerId") || null;
  const customer = customerId ? await resolveOutboundCustomer(customerId) : null;

  const productIds = formData.getAll("lineProductId").map((v) => String(v).trim());
  const locationIds = formData
    .getAll("lineLocationId")
    .map((v) => String(v).trim());
  const quantities = formData.getAll("lineQuantity").map((v) => String(v).trim());
  const packageIds = formData.getAll("linePackageId").map((v) => String(v).trim());
  const lotIds = flags.lots
    ? formData.getAll("lineLotId").map((v) => String(v).trim())
    : [];

  if (productIds.length === 0) {
    return throwLocalized("errors.documents.addAtLeastOneLine");
  }

  const lines: Array<{
    productId: string;
    locationId: string;
    packageId: string | null;
    packageQty: number | null;
    quantity: number;
    lotId: string | null;
  }> = [];

  for (let i = 0; i < productIds.length; i++) {
    const productId = productIds[i];
    const locationId = locationIds[i];
    const enteredQty = Number(quantities[i]);
    if (!productId || !locationId || !Number.isFinite(enteredQty) || enteredQty <= 0) {
      return throwLocalized("errors.documents.lineProductLocationQty", {
        line: i + 1,
      });
    }

    const packageIdRaw = packageIds[i] || "";
    let packageId: string | null = null;
    let packageQty: number | null = null;
    let quantity = enteredQty;

    if (packageIdRaw) {
      const pkg = await prisma.package.findFirst({
        where: { id: packageIdRaw, productId, isActive: true },
      });
      if (!pkg) {
        return throwLocalized("errors.documents.lineSelectPackageForProduct", {
        line: i + 1,
      });
      }
      packageId = pkg.id;
      packageQty = enteredQty;
      quantity = enteredQty * pkg.factor;
    }

    let lotId: string | null = null;
    const lotIdRaw = flags.lots ? lotIds[i] || "" : "";
    if (lotIdRaw) {
      const lot = await prisma.lot.findUnique({ where: { id: lotIdRaw } });
      if (!lot || lot.productId !== productId) {
        return throwLocalized("errors.documents.lineSelectLot", { line: i + 1 });
      }
      lotId = lot.id;
    }

    lines.push({
      productId,
      locationId,
      packageId,
      packageQty,
      quantity,
      lotId,
    });
  }

  const number = await nextDocNumber("OUT");
  const receivingDockId = str(formData, "receivingDockId") || null;
  const transportUnitId = str(formData, "transportUnitId") || null;
  if (receivingDockId) {
    await assertReceivingDockAssignable(receivingDockId, undefined, "outbound");
  }

  const doc = await prisma.outboundDocument.create({
    data: {
      number,
      customer,
      kind: parseOutboundKind(str(formData, "kind")),
      salesOrderRef: str(formData, "salesOrderRef") || null,
      waybillRef: str(formData, "waybillRef") || null,
      externalRef: str(formData, "externalRef") || null,
      shipDate: parseOptionalDate(formData.get("shipDate")),
      actualShipmentAt: parseOptionalDate(formData.get("actualShipmentAt")),
      receivingDockId,
      transportUnitId,
      notes: str(formData, "notes") || null,
      lines: {
        create: lines.map((line, index) => ({
          productId: line.productId,
          locationId: line.locationId,
          packageId: line.packageId,
          packageQty: line.packageQty,
          quantity: line.quantity,
          lotId: line.lotId,
          lineNo: index + 1,
        })),
      },
    },
  });

  await recordOutboundStatusChange(prisma, {
    documentId: doc.id,
    fromStatus: null,
    toStatus: "DRAFT",
    changedById: user.id,
    source: "web",
    note: "Создание документа",
  });

  await saveDocumentExtraFromForm("outbound", doc.id, formData, doc.number);

  await syncReceivingDockStatus(receivingDockId);

  revalidatePath("/doc/outbound");
  revalidatePath("/outbound");
  redirect(`/doc/outbound/${doc.id}`);
}

export async function addOutboundLine(documentId: string, formData: FormData) {
  await requireModuleWrite("outbound");
  const flags = await getModuleFlags();
  const doc = await prisma.outboundDocument.findUniqueOrThrow({
    where: { id: documentId },
  });
  if (doc.status !== "DRAFT") return throwLocalized("errors.documents.notDraft");

  const productId = str(formData, "productId");
  const locationId = str(formData, "locationId");
  const enteredQty = num(formData, "quantity") ?? 0;
  const lotId = flags.lots ? str(formData, "lotId") || null : null;
  const packageIdRaw = str(formData, "packageId") || null;
  if (!productId || !locationId || enteredQty <= 0) {
    return throwLocalized("errors.documents.fillProductLocationQty");
  }

  let packageId: string | null = null;
  let packageQty: number | null = null;
  let quantity = enteredQty;
  if (packageIdRaw) {
    const pkg = await prisma.package.findFirst({
      where: { id: packageIdRaw, productId, isActive: true },
    });
    if (!pkg) return throwLocalized("errors.documents.selectPackageForProduct");
    packageId = pkg.id;
    packageQty = enteredQty;
    quantity = enteredQty * pkg.factor;
  }

  const lineCount = await prisma.outboundLine.count({ where: { documentId } });
  await prisma.outboundLine.create({
    data: {
      documentId,
      productId,
      locationId,
      packageId,
      packageQty,
      lotId,
      quantity,
      lineNo: lineCount + 1,
    },
  });
  revalidatePath(`/doc/outbound/${documentId}`);
  redirect(`/doc/outbound/${documentId}`);
}

export async function postOutboundDocument(documentId: string) {
  await requireModuleWrite("outbound");
  const user = await requireUser();
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const allowNegative = settings?.allowNegativeStock ?? false;

  const result = await prisma.$transaction(async (tx) => {
    const doc = await tx.outboundDocument.findUniqueOrThrow({
      where: { id: documentId },
      include: { lines: true },
    });
    if (doc.status !== "DRAFT" && doc.status !== "RELEASED") {
      return throwLocalized("errors.documents.alreadyPostedOrCancelled");
    }
    if (doc.lines.length === 0) return throwLocalized("errors.documents.noLines");

    const fromStatus = doc.status;

    for (const line of doc.lines) {
      await bumpStock(
        tx,
        line.productId,
        line.locationId,
        -line.quantity,
        allowNegative,
        line.lotId,
        null,
        line.packageId,
      );
      await tx.stockMovement.create({
        data: {
          type: "SHIPMENT",
          productId: line.productId,
          lotId: line.lotId,
          packageId: line.packageId,
          fromLocationId: line.locationId,
          quantity: line.quantity,
          referenceType: "OutboundDocument",
          referenceId: doc.id,
          note: doc.number,
        },
      });
    }

    const updated = await tx.outboundDocument.update({
      where: { id: documentId },
      data: { status: "POSTED", postedAt: new Date() },
    });
    await recordOutboundStatusChange(tx, {
      documentId,
      fromStatus,
      toStatus: "POSTED",
      changedById: user.id,
      source: "web",
    });
    return updated;
  });

  await enqueueOutbox({
    eventType: "outbound.posted",
    aggregateType: "OutboundDocument",
    aggregateId: result.id,
    payload: { id: result.id, number: result.number },
  });

  await syncOutboundDocumentDock(documentId);

  revalidatePath("/doc/outbound");
  revalidatePath("/outbound");
  revalidatePath(`/doc/outbound/${documentId}`);
  revalidatePath("/inventory");
  revalidatePath("/lots");
  revalidatePath("/catalog/receiving_docks");
  revalidatePath("/");
}

export async function updateOutboundDocumentStatus(formData: FormData) {
  await requireEntityPermission("outbound", "write");
  const user = await requireUser();
  const documentId = str(formData, "documentId");
  const nextStatus = str(formData, "status");
  if (!documentId || !nextStatus) {
    return throwLocalized("errors.documents.documentAndStatusRequired");
  }

  const doc = await prisma.outboundDocument.findUniqueOrThrow({
    where: { id: documentId },
    include: { _count: { select: { lines: true } } },
  });

  const allowed = await outboundStatusOptions(doc.status, {
    lineCount: doc._count.lines,
  });
  if (!allowed.includes(nextStatus)) {
    const workflowAllowed = await isTransitionAllowed(
      "outbound",
      doc.status,
      nextStatus,
      "manual",
      { documentId, lineCount: doc._count.lines, entityCode: "outbound" },
    );
    if (!workflowAllowed) {
      return throwLocalized("errors.documents.statusTransitionUnavailable");
    }
  }
  if (nextStatus === doc.status) return;

  if (nextStatus === "RELEASED" && doc._count.lines === 0) {
    return throwLocalized("errors.documents.addLineBeforeRelease");
  }

  if (nextStatus === "POSTED") {
    await postOutboundDocument(documentId);
    return;
  }

  const fromStatus = doc.status;
  await prisma.$transaction(async (tx) => {
    await tx.outboundDocument.update({
      where: { id: documentId },
      data: { status: nextStatus },
    });
    await recordOutboundStatusChange(tx, {
      documentId,
      fromStatus,
      toStatus: nextStatus,
      changedById: user.id,
      source: "web",
    });
  });

  await syncOutboundDocumentDock(documentId);

  revalidatePath("/doc/outbound");
  revalidatePath("/outbound");
  revalidatePath(`/doc/outbound/${documentId}`);
  revalidatePath("/catalog/receiving_docks");
  revalidatePath("/");
}

export async function updateOperationDocumentStatus(formData: FormData) {
  await requireEntityPermission("operation", "write");
  const documentId = str(formData, "documentId");
  const nextStatus = str(formData, "status");
  if (!documentId || !nextStatus) {
    return throwLocalized("errors.documents.documentAndStatusRequired");
  }

  const doc = await prisma.operationDocument.findUniqueOrThrow({
    where: { id: documentId },
    include: { _count: { select: { lines: true } } },
  });
  if (nextStatus === doc.status) return;

  const allowed = await isTransitionAllowed(
    "operation",
    doc.status,
    nextStatus,
    "manual",
    { documentId, lineCount: doc._count.lines, entityCode: "operation" },
  );
  if (!allowed) {
    return throwLocalized("errors.documents.statusTransitionUnavailable");
  }

  await prisma.operationDocument.update({
    where: { id: documentId },
    data: { status: nextStatus },
  });

  revalidatePath("/doc/operation");
  revalidatePath("/operations");
  revalidatePath(`/doc/operation/${documentId}`);
}

/* ─── Inventory / control ─── */

export async function createLot(formData: FormData) {
  await requireModuleWrite("lots");
  const productId = str(formData, "productId");
  const number = str(formData, "number");
  const expiryDate = parseOptionalDate(formData.get("expiryDate"));
  const manufacturedAt = parseOptionalDate(formData.get("manufacturedAt"));
  if (!productId || !number) {
    return throwLocalized("errors.documents.productAndLotRequired");
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
  });
  if (!product) return throwLocalized("errors.documents.productNotFound");

  const existing = await prisma.lot.findUnique({
    where: { productId_number: { productId, number } },
  });
  if (existing) return throwLocalized("errors.documents.lotExistsForProduct");

  const resolvedMfg = calcManufacturedAt(
    expiryDate,
    product.shelfLifeDays,
    product.shelfLifeUnit,
    manufacturedAt,
  );

  const lot = await prisma.lot.create({
    data: {
      productId,
      number,
      expiryDate,
      manufacturedAt: resolvedMfg,
    },
  });

  revalidatePath("/lots");
  revalidatePath(`/lots/${lot.id}`);
  revalidatePath("/doc/inbound");
  revalidatePath("/inbound");
  revalidatePath("/doc/outbound");
  revalidatePath("/outbound");
  revalidatePath("/inventory");

  const returnTo = str(formData, "returnTo");
  if (
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    returnTo !== "/lots"
  ) {
    redirect(returnTo);
  }
  redirect(`/lots/${lot.id}`);
}

export async function updateLot(lotId: string, formData: FormData) {
  await requireModuleWrite("lots");
  const expiryDate = parseOptionalDate(formData.get("expiryDate"));
  const manufacturedAt = parseOptionalDate(formData.get("manufacturedAt"));

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: { product: true },
  });
  if (!lot) return throwLocalized("errors.documents.lotNotFound");

  const resolvedMfg = calcManufacturedAt(
    expiryDate,
    lot.product.shelfLifeDays,
    lot.product.shelfLifeUnit,
    manufacturedAt,
  );

  await prisma.lot.update({
    where: { id: lotId },
    data: {
      expiryDate,
      manufacturedAt: resolvedMfg,
    },
  });

  revalidatePath("/lots");
  revalidatePath(`/lots/${lotId}`);
  revalidatePath(`/lots/${lotId}/edit`);
  revalidatePath("/doc/inbound");
  revalidatePath("/inbound");
  revalidatePath("/doc/outbound");
  revalidatePath("/outbound");
  revalidatePath("/inventory");

  redirect(`/lots/${lotId}`);
}

export async function updateCellMapPosition(formData: FormData) {
  await requireModuleWrite("topology");
  const id = str(formData, "id");
  const mapX = num(formData, "mapX") ?? 40;
  const mapY = num(formData, "mapY") ?? 40;
  const mapW = num(formData, "mapW") ?? 80;
  const mapH = num(formData, "mapH") ?? 48;
  await prisma.location.update({
    where: { id },
    data: { mapX, mapY, mapW, mapH },
  });
  revalidatePath("/topology");
}

export async function updateTopologyCanvas(formData: FormData) {
  await requireModuleWrite("topology");
  const topologyWidth = num(formData, "topologyWidth") ?? 1200;
  const topologyHeight = num(formData, "topologyHeight") ?? 800;
  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, topologyWidth, topologyHeight },
    update: { topologyWidth, topologyHeight },
  });
  revalidatePath("/topology");
  revalidatePath("/settings");
}

export async function adjustStockBalance(formData: FormData) {
  await requireModuleWrite("inventory");
  const productId = str(formData, "productId");
  const locationId = str(formData, "locationId");
  const quantity = num(formData, "quantity");
  const lotId = str(formData, "lotId") || null;
  const packageId = str(formData, "packageId") || null;
  const note = str(formData, "note") || "Корректировка остатков";

  if (!productId || !locationId || quantity == null) {
    return throwLocalized("errors.actions.inventoryFieldsRequired");
  }

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const allowNegative = settings?.allowNegativeStock ?? false;

  const balance = await prisma.stockBalance.findFirst({
    where: { productId, locationId, lotId, packageId },
  });
  const current = balance?.quantity ?? 0;
  const delta = quantity - current;

  await prisma.$transaction(async (tx) => {
    await bumpStock(
      tx,
      productId,
      locationId,
      delta,
      allowNegative,
      lotId,
      null,
      packageId,
    );
    await tx.stockMovement.create({
      data: {
        type: "ADJUSTMENT",
        productId,
        lotId,
        packageId,
        quantity: Math.abs(delta),
        toLocationId: delta >= 0 ? locationId : null,
        fromLocationId: delta < 0 ? locationId : null,
        note,
      },
    });
  });

  revalidatePath("/inventory");
  revalidatePath("/operations");
}
