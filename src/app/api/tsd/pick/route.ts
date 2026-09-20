import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  requireTsdAuth,
  requireTsdPermission,
  jsonOk,
  jsonApiError,
} from "@/lib/tsd-auth";
import { apiErrorMessage } from "@/lib/i18n/api";
import { getApiLocale } from "@/lib/i18n/locale-server";
import { prisma } from "@/lib/db";
import { bumpStock } from "@/lib/stock";
import { enqueueOutbox } from "@/lib/integration/outbox";
import { createOperationDocument } from "@/lib/operation-document";
import { getModuleFlags } from "@/lib/session";
import { findActiveLocationByIdOrCode } from "@/lib/ci-lookup";
import { tsdPickSchema } from "@/lib/schemas/tsd";
import { runTsdRoute } from "@/lib/tsd-handler";
import { isDocumentOpenForTsd } from "@/lib/workflow/tsd";

export async function POST(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;
  const denied = await requireTsdPermission("tsd.pick");
  if (denied) return denied;

  return runTsdRoute(async () => {
    const body = await request.json();
    const parsed = tsdPickSchema.safeParse({
      ...body,
      quantity: Number(body.quantity ?? 0),
    });
    if (!parsed.success) {
      return jsonApiError("invalidPayload");
    }

    const {
      productBarcode,
      locationCode,
      quantity,
      lotNumber,
      packageId: packageIdIn,
      documentId,
    } = parsed.data;

    const flags = await getModuleFlags();

    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
        OR: [{ barcode: productBarcode }, { sku: productBarcode }],
      },
      include: { accountingModel: true },
    });
    if (!product) return jsonApiError("productNotFound", 404);

    const location = await findActiveLocationByIdOrCode({ code: locationCode });
    if (!location) return jsonApiError("locationNotFound", 404);

    const { resolveLotAccountingPolicy } = await import("@/lib/accounting-model");
    const policy = resolveLotAccountingPolicy(product);

    let lotId: string | null = null;
    const lotNum = lotNumber?.trim() || null;
    if (flags.lots && lotNum) {
      const lot = await prisma.lot.findUnique({
        where: { productId_number: { productId: product.id, number: lotNum } },
      });
      if (!lot) return jsonApiError("lotNotFound", 404);
      lotId = lot.id;
    } else if (flags.lots && policy.useLots) {
      return jsonApiError(
        policy.useSerial ? "serialNumberRequired" : "lotNumberRequired",
      );
    }

    let packageId: string | null = packageIdIn?.trim() || null;
    if (packageId) {
      const pkg = await prisma.package.findFirst({
        where: { id: packageId, productId: product.id, isActive: true },
      });
      if (!pkg) return jsonApiError("packageNotFound", 404);
    } else if (documentId) {
      const planned = await prisma.outboundLine.findFirst({
        where: { documentId, productId: product.id },
        orderBy: { lineNo: "asc" },
      });
      packageId = planned?.packageId ?? null;
    }

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const allowNegative = settings?.allowNegativeStock ?? false;
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const result = await prisma.$transaction(async (tx) => {
      if (documentId) {
        const doc = await tx.outboundDocument.findUnique({
          where: { id: documentId },
        });
        if (!doc || !(await isDocumentOpenForTsd("outbound", doc.status))) {
          const locale = await getApiLocale();
          throw new Error(apiErrorMessage("outboundDocumentUnavailable", locale));
        }
        await tx.outboundLine.create({
          data: {
            documentId,
            productId: product.id,
            locationId: location.id,
            packageId,
            lotId,
            quantity,
          },
        });
        return {
          mode: "draft_line" as const,
          productId: product.id,
          locationId: location.id,
          lotId,
          packageId,
        };
      }

      await bumpStock(
        tx,
        product.id,
        location.id,
        -quantity,
        allowNegative,
        lotId,
        null,
        packageId,
      );

      const op = await createOperationDocument(tx, {
        type: "PICK",
        status: "POSTED",
        createdByUserId: userId,
        fromLocationId: location.id,
        notes: "ТСД отбор",
        lines: [
          {
            productId: product.id,
            quantity,
            packageId,
            lotId,
            fromLocationId: location.id,
          },
        ],
      });

      const movement = await tx.stockMovement.create({
        data: {
          type: "SHIPMENT",
          productId: product.id,
          lotId,
          packageId,
          fromLocationId: location.id,
          quantity,
          referenceType: "OperationDocument",
          referenceId: op.id,
          note: `ТСД отбор · ${op.number}`,
        },
      });

      return {
        mode: "posted" as const,
        productId: product.id,
        locationId: location.id,
        lotId,
        packageId,
        movementId: movement.id,
        operationDocumentId: op.id,
      };
    });

    if (result.mode === "posted" && result.movementId) {
      await enqueueOutbox({
        eventType: "stock.shipment",
        aggregateType: "StockMovement",
        aggregateId: result.movementId,
        payload: result,
      });
    }

    return jsonOk({ ok: true, ...result });
  });
}
