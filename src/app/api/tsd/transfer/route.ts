import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { requireTsdAuth, requireTsdPermission, jsonOk, jsonError, jsonApiError } from "@/lib/tsd-auth";
import { prisma } from "@/lib/db";
import { bumpStock } from "@/lib/stock";
import { enqueueOutbox } from "@/lib/integration/outbox";
import { createOperationDocument } from "@/lib/operation-document";
import { getModuleFlags } from "@/lib/session";
import { findActiveLocationByIdOrCode } from "@/lib/ci-lookup";

import { runTsdRoute } from "@/lib/tsd-handler";

export async function POST(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;
  const denied = await requireTsdPermission("tsd.transfer");
  if (denied) return denied;

  return runTsdRoute(async () => {
  const body = await request.json();
  const productBarcode = String(body.productBarcode || "").trim();
  const fromCode = String(body.fromLocationCode || "").trim();
  const toCode = String(body.toLocationCode || "").trim();
  const quantity = Number(body.quantity || 0);
  const lotNumber = String(body.lotNumber || "").trim() || null;
  const packageIdIn = String(body.packageId || "").trim() || null;

  if (!productBarcode || !fromCode || !toCode || quantity <= 0) {
    return jsonApiError("transferFieldsRequired");
  }

  const flags = await getModuleFlags();

  const product = await prisma.product.findFirst({
    where: {
      isActive: true,
      OR: [{ barcode: productBarcode }, { sku: productBarcode }],
    },
  });
  if (!product) return jsonError("Товар не найден", 404);

  const fromLocation = await findActiveLocationByIdOrCode({ code: fromCode });
  const toLocation = await findActiveLocationByIdOrCode({ code: toCode });
  if (!fromLocation || !toLocation) return jsonError("Ячейка не найдена", 404);

  let lotId: string | null = null;
  if (flags.lots && lotNumber) {
    const lot = await prisma.lot.findUnique({
      where: { productId_number: { productId: product.id, number: lotNumber } },
    });
    if (!lot) return jsonError("Партия не найдена", 404);
    lotId = lot.id;
  }

  let packageId: string | null = packageIdIn;
  if (packageId) {
    const pkg = await prisma.package.findFirst({
      where: { id: packageId, productId: product.id, isActive: true },
    });
    if (!pkg) return jsonError("Упаковка не найдена", 404);
  } else {
    // Если упаковка не указана — переносим из той упаковки, где есть остаток.
    const bal = await prisma.stockBalance.findFirst({
      where: {
        productId: product.id,
        locationId: fromLocation.id,
        quantity: { gt: 0 },
        ...(lotId ? { lotId } : {}),
      },
      orderBy: { quantity: "desc" },
    });
    packageId = bal?.packageId ?? null;
  }

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const allowNegative = settings?.allowNegativeStock ?? false;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const movement = await prisma.$transaction(async (tx) => {
    await bumpStock(
      tx,
      product.id,
      fromLocation.id,
      -quantity,
      allowNegative,
      lotId,
      null,
      packageId,
    );
    await bumpStock(
      tx,
      product.id,
      toLocation.id,
      quantity,
      true,
      lotId,
      null,
      packageId,
    );

    const op = await createOperationDocument(tx, {
      type: "TRANSFER",
      status: "POSTED",
      createdByUserId: userId,
      fromLocationId: fromLocation.id,
      toLocationId: toLocation.id,
      notes: "ТСД перемещение",
      lines: [
        {
          productId: product.id,
          quantity,
          packageId,
          lotId,
          fromLocationId: fromLocation.id,
          toLocationId: toLocation.id,
        },
      ],
    });

    return tx.stockMovement.create({
      data: {
        type: "TRANSFER",
        productId: product.id,
        lotId,
        packageId,
        fromLocationId: fromLocation.id,
        toLocationId: toLocation.id,
        quantity,
        referenceType: "OperationDocument",
        referenceId: op.id,
        note: `ТСД перемещение · ${op.number}`,
      },
    });
  });

  await enqueueOutbox({
    eventType: "stock.transfer",
    aggregateType: "StockMovement",
    aggregateId: movement.id,
    payload: {
      movementId: movement.id,
      productId: product.id,
      fromLocationId: fromLocation.id,
      toLocationId: toLocation.id,
      quantity,
      lotId,
      operationDocumentId: movement.referenceId,
    },
  });

  return jsonOk({ ok: true, movementId: movement.id });
  });
}
