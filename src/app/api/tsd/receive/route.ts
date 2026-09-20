import { NextRequest } from "next/server";
import { requireTsdAuth, requireTsdPermission, jsonOk, jsonError, jsonApiError } from "@/lib/tsd-auth";
import { apiErrorMessage } from "@/lib/i18n/api";
import { getApiLocale } from "@/lib/i18n/locale-server";
import { prisma } from "@/lib/db";
import { bumpStock, ensureLot } from "@/lib/stock";
import { enqueueOutbox } from "@/lib/integration/outbox";
import { auth } from "@/lib/auth";
import { getModuleFlags } from "@/lib/session";
import { tryAcceptInboundAfterTsd } from "@/lib/inbound-complete";
import { resolveLotAccountingPolicy } from "@/lib/accounting-model";
import { allocateLotNumber } from "@/lib/lot-name";
import { parseDateInput, resolveLotDates } from "@/lib/lot-dates";
import { resolveTsdLocation } from "@/lib/tsd-location";
import { findActivePalletByIdOrCode } from "@/lib/ci-lookup";
import { isDocumentOpenForTsd } from "@/lib/workflow/tsd";

/**
 * TSD receive onto TN (товарный носитель):
 * body: documentId, palletCode|palletId, locationCode, productBarcode|productId, quantity, lotNumber?
 */
export async function POST(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;
  const denied = await requireTsdPermission("tsd.receive");
  if (denied) return denied;

  const body = await request.json();
  const documentId = String(body.documentId || "").trim();
  let locationCode = String(body.locationCode || "").trim();
  if (!locationCode) {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (settings?.defaultReceivingLocId) {
      const defaultLoc = await prisma.location.findUnique({
        where: { id: settings.defaultReceivingLocId },
      });
      locationCode = defaultLoc?.code?.trim() ?? "";
    }
  }
  const productBarcode = String(body.productBarcode || "").trim();
  const productIdIn = String(body.productId || "").trim();
  const quantity = Number(body.quantity || 0);
  const lotNumber = String(body.lotNumber || "").trim() || null;
  const serialNumber = String(body.serialNumber || "").trim() || null;
  const expiryDate = body.expiryDate
    ? parseDateInput(String(body.expiryDate))
    : null;
  const manufacturedAt = body.manufacturedAt
    ? parseDateInput(String(body.manufacturedAt))
    : null;
  const packageIdIn = String(body.packageId || "").trim() || null;
  const palletCode = String(body.palletCode || body.tnCode || "").trim();
  const palletIdIn = String(body.palletId || "").trim();
  const sessionId = String(body.sessionId || "").trim() || null;

  if ((!productBarcode && !productIdIn) || !locationCode || quantity <= 0) {
    return jsonApiError("productLocationQtyRequired");
  }
  if (!documentId) return jsonApiError("documentIdRequired");
  if (!palletCode && !palletIdIn) return jsonApiError("palletRequired");

  const flags = await getModuleFlags();

  let product = productIdIn
    ? await prisma.product.findFirst({
        where: { id: productIdIn, isActive: true },
        include: { accountingModel: true },
      })
    : await prisma.product.findFirst({
        where: {
          isActive: true,
          OR: [{ barcode: productBarcode }, { sku: productBarcode }],
        },
        include: { accountingModel: true },
      });

  // Штрихкод может быть у упаковки (коробка), а не у номенклатуры.
  if (!product && productBarcode) {
    const byPkg = await prisma.package.findFirst({
      where: { barcode: productBarcode, isActive: true },
      include: { product: { include: { accountingModel: true } } },
    });
    if (byPkg?.product?.isActive) product = byPkg.product;
  }
  if (!product) return jsonApiError("productNotFound", 404);

  const scannedPackage = packageIdIn
    ? await prisma.package.findFirst({
        where: { id: packageIdIn, productId: product.id, isActive: true },
      })
    : productBarcode
      ? await prisma.package.findFirst({
          where: {
            barcode: productBarcode,
            productId: product.id,
            isActive: true,
          },
        })
      : null;

  const locationResolved = await resolveTsdLocation(locationCode, "receive");
  if (!locationResolved.ok) {
    return jsonError(
      locationResolved.error,
      locationResolved.notFound ? 404 : 400,
    );
  }
  const location = await prisma.location.findUniqueOrThrow({
    where: { id: locationResolved.location.id },
  });

  const pallet = await findActivePalletByIdOrCode({
    id: palletIdIn,
    code: palletCode,
  });
  if (!pallet) return jsonApiError("palletNotFound", 404);
  if (pallet.status !== "AVAILABLE") {
    if (pallet.status === "ACCEPTED") {
      return jsonApiError("palletAcceptedSelectAvailable");
    }
    if (pallet.status === "PLACED") {
      return jsonApiError("palletPlacedSelectAvailable");
    }
    return jsonApiError("palletAvailableRequiredForReceive");
  }

  const doc = await prisma.inboundDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc || !(await isDocumentOpenForTsd("inbound", doc.status))) {
    return jsonApiError("inboundDocumentUnavailable");
  }

  const plannedByLot = lotNumber
    ? await prisma.inboundLine.findFirst({
        where: {
          documentId,
          productId: product.id,
          locationId: null,
          OR: [{ lotNumber }, { lot: { number: lotNumber } }],
          ...(scannedPackage ? { packageId: scannedPackage.id } : {}),
        },
        orderBy: { lineNo: "asc" },
        include: { package: true, lot: true },
      })
    : null;
  const plannedByPackage = scannedPackage
    ? await prisma.inboundLine.findFirst({
        where: {
          documentId,
          productId: product.id,
          locationId: null,
          packageId: scannedPackage.id,
        },
        orderBy: { lineNo: "asc" },
        include: { package: true, lot: true },
      })
    : null;
  const planned =
    plannedByLot ??
    plannedByPackage ??
    (await prisma.inboundLine.findFirst({
      where: {
        documentId,
        productId: product.id,
        locationId: null,
      },
      orderBy: { lineNo: "asc" },
      include: { package: true, lot: true },
    }));

  const plannedLotNumber =
    planned?.lotNumber?.trim() || planned?.lot?.number?.trim() || null;
  const plannedExpiry =
    planned?.expiryDate ?? planned?.lot?.expiryDate ?? null;
  const plannedMfg = planned?.lot?.manufacturedAt ?? null;

  const policy = resolveLotAccountingPolicy(product);
  const lotsOn = flags.lots && policy.useLots;

  let resolvedExpiry: Date | null = null;
  let resolvedMfg: Date | null = null;

  if (lotsOn && policy.useExpiry) {
    const dates = resolveLotDates({
      expiryDate: expiryDate || plannedExpiry,
      manufacturedAt: manufacturedAt || plannedMfg,
      shelfLifeDays: product.shelfLifeDays,
      shelfLifeUnit: product.shelfLifeUnit,
    });
    if (!dates.ok) return jsonApiError(dates.errorKey);
    resolvedExpiry = dates.expiryDate;
    resolvedMfg = dates.manufacturedAt;
  }

  let resolvedLotNumber: string | null = null;
  if (lotsOn) {
    if (policy.useSerial) {
      resolvedLotNumber = serialNumber || lotNumber || plannedLotNumber;
      if (!resolvedLotNumber) {
        return jsonApiError("serialNumberRequired");
      }
    } else {
      resolvedLotNumber = lotNumber || plannedLotNumber;
      if (!resolvedLotNumber && policy.lotNameTemplate) {
        // номер выделим в транзакции по шаблону
        resolvedLotNumber = null;
      } else if (!resolvedLotNumber && !policy.lotNameTemplate) {
        return jsonApiError("lotNumberRequired");
      }
    }
  }

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const allowNegative = settings?.allowNegativeStock ?? false;
  const session = await auth();

  const result = await prisma.$transaction(async (tx) => {
    let lotId: string | null = null;
    let finalLotNumber = resolvedLotNumber;
    if (lotsOn) {
      if (!finalLotNumber && policy.lotNameTemplate) {
        finalLotNumber = await allocateLotNumber(
          tx,
          product.id,
          product.sku,
          policy.lotNameTemplate,
          {
            expiryDate: resolvedExpiry,
            serial: serialNumber,
          },
        );
      }
      if (!finalLotNumber) {
        const locale = await getApiLocale();
        throw new Error(apiErrorMessage("lotNumberRequired", locale));
      }
      const lot = await ensureLot(
        tx,
        product.id,
        finalLotNumber,
        resolvedExpiry,
        resolvedMfg,
      );
      lotId = lot.id;
    }

    // Упаковка: со скана / из тела запроса, иначе из плановой строки.
    const pkg = scannedPackage ?? planned?.package ?? null;
    const packageId = pkg?.id ?? planned?.packageId ?? null;
    const factor = pkg && pkg.factor > 0 ? pkg.factor : 1;
    // quantity с ТСД — кол-во упаковок (или базовых ед., если упаковка ×1).
    const packageQty = packageId ? quantity : null;
    const baseQty = quantity * factor;

    const lineCount = await tx.inboundLine.count({ where: { documentId } });
    const line = await tx.inboundLine.create({
      data: {
        documentId,
        productId: product.id,
        packageId,
        packageQty,
        locationId: location.id,
        palletId: pallet.id,
        lotId,
        lotNumber: finalLotNumber,
        expiryDate: resolvedExpiry,
        quantity: baseQty,
        lineNo: lineCount + 1,
      },
    });

    await tx.pallet.update({
      where: { id: pallet.id },
      data: { locationId: location.id },
    });

    await bumpStock(
      tx,
      product.id,
      location.id,
      baseQty,
      allowNegative,
      lotId,
      pallet.id,
      packageId,
    );
    const movement = await tx.stockMovement.create({
      data: {
        type: "RECEIPT",
        productId: product.id,
        lotId,
        palletId: pallet.id,
        packageId,
        toLocationId: location.id,
        quantity: baseQty,
        referenceType: "InboundDocument",
        referenceId: documentId,
        note: `ТСД приёмка на ТН ${pallet.code}`,
      },
    });

    if (sessionId) {
      await tx.tsdTaskSession.updateMany({
        where: { id: sessionId, status: "open" },
        data: {
          documentId,
          palletId: pallet.id,
          locationId: location.id,
          userId: session?.user?.id ?? undefined,
        },
      });
    }

    return { lineId: line.id, movementId: movement.id, palletId: pallet.id };
  });

  await enqueueOutbox({
    eventType: "stock.receipt",
    aggregateType: "StockMovement",
    aggregateId: result.movementId,
    payload: result,
  });

  const completion = await tryAcceptInboundAfterTsd(documentId);

  return jsonOk({ ok: true, ...result, accepted: completion.accepted });
}
