import { NextRequest } from "next/server";
import { requireTsdAuth, requireTsdPermission, jsonOk, jsonApiError } from "@/lib/tsd-auth";
import { prisma } from "@/lib/db";
import { enqueueOutbox } from "@/lib/integration/outbox";
import { findActivePalletByIdOrCode } from "@/lib/ci-lookup";
import { createOperationDocument } from "@/lib/operation-document";
import { ensurePutawayTaskForPallet } from "@/lib/operation-tasks";
import { auth } from "@/lib/auth";

/**
 * Закрыть приёмку на ТН: AVAILABLE → ACCEPTED.
 * Создаёт документ операции «Отчёт о приёмке».
 */
export async function POST(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;
  const denied = await requireTsdPermission("tsd.receive");
  if (denied) return denied;

  const body = await request.json();
  const palletIdIn = String(body.palletId || "").trim();
  const palletCode = String(body.palletCode || body.tnCode || "").trim();
  const sessionId = String(body.sessionId || "").trim() || null;
  const documentId = String(body.documentId || "").trim() || null;

  const pallet = await findActivePalletByIdOrCode({
    id: palletIdIn,
    code: palletCode,
  });
  if (!pallet) return jsonApiError("palletNotFound", 404);

  if (pallet.status === "ACCEPTED") {
    const putawayTask = await ensurePutawayTaskForPallet(pallet.id);
    return jsonOk({
      ok: true,
      pallet,
      alreadyAccepted: true,
      putawayTask: putawayTask
        ? { id: putawayTask.id, number: putawayTask.number }
        : null,
    });
  }
  if (pallet.status === "PLACED") {
    return jsonApiError("palletPlacedNoReReceive");
  }
  if (pallet.status !== "AVAILABLE") {
    return jsonApiError("completeReceiveAvailableOnly");
  }

  const stock = await prisma.stockBalance.aggregate({
    where: { palletId: pallet.id, quantity: { gt: 0 } },
    _sum: { quantity: true },
  });
  if (!(stock._sum.quantity && stock._sum.quantity > 0)) {
    return jsonApiError("palletNoReceivedStock");
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const factLines = await prisma.inboundLine.findMany({
    where: {
      palletId: pallet.id,
      locationId: { not: null },
      ...(documentId ? { documentId } : {}),
    },
    orderBy: { lineNo: "asc" },
  });

  const result = await prisma.$transaction(async (tx) => {
    const p = await tx.pallet.update({
      where: { id: pallet.id },
      data: { status: "ACCEPTED" },
    });

    const inboundId =
      documentId ||
      factLines[0]?.documentId ||
      (
        await tx.inboundLine.findFirst({
          where: { palletId: pallet.id },
          select: { documentId: true },
        })
      )?.documentId ||
      null;

    const op = await createOperationDocument(tx, {
      type: "RECEIVE_REPORT",
      status: "POSTED",
      createdByUserId: userId,
      inboundDocumentId: inboundId,
      palletId: pallet.id,
      sessionId,
      toLocationId: pallet.locationId ?? factLines[0]?.locationId ?? null,
      notes: `Приёмка на ТН ${p.code}`,
      lines: factLines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        packageId: l.packageId,
        packageQty: l.packageQty,
        lotId: l.lotId,
        palletId: pallet.id,
        toLocationId: l.locationId,
      })),
    });

    // Привязать движения приёмки к отчёту
    await tx.stockMovement.updateMany({
      where: {
        palletId: pallet.id,
        type: "RECEIPT",
        ...(inboundId
          ? { referenceType: "InboundDocument", referenceId: inboundId }
          : {}),
      },
      data: {
        referenceType: "OperationDocument",
        referenceId: op.id,
        note: `Отчёт о приёмке ${op.number} · ТН ${p.code}`,
      },
    });

    if (sessionId) {
      await tx.tsdTaskSession.updateMany({
        where: { id: sessionId, status: "open", type: "receive" },
        data: {
          status: "closed",
          closedAt: new Date(),
          palletId: pallet.id,
          documentId: documentId ?? undefined,
        },
      });
    }

    return { pallet: p, operation: op, inboundId };
  });

  await enqueueOutbox({
    eventType: "pallet.accepted",
    aggregateType: "Pallet",
    aggregateId: result.pallet.id,
    payload: {
      id: result.pallet.id,
      code: result.pallet.code,
      status: result.pallet.status,
      documentId,
      operationDocumentId: result.operation.id,
      operationNumber: result.operation.number,
    },
  });

  const putawayTask = await ensurePutawayTaskForPallet(result.pallet.id, {
    inboundDocumentId: result.inboundId,
  });

  return jsonOk({
    ok: true,
    pallet: result.pallet,
    operation: {
      id: result.operation.id,
      number: result.operation.number,
      type: result.operation.type,
    },
    putawayTask: putawayTask
      ? { id: putawayTask.id, number: putawayTask.number }
      : null,
  });
}
