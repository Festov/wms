import { NextRequest } from "next/server";
import { requireTsdAuth, requireTsdPermission, jsonOk, jsonError, jsonApiError } from "@/lib/tsd-auth";
import { prisma } from "@/lib/db";
import { transferPalletStock } from "@/lib/stock";
import { enqueueOutbox } from "@/lib/integration/outbox";
import { planPutawayForPallet } from "@/lib/putaway/engine";
import { resolveTsdLocation } from "@/lib/tsd-location";
import {
  findInboundDocumentIdsForPallet,
  tryPlaceInboundAfterPutaway,
} from "@/lib/inbound-place";
import { findActivePalletByIdOrCode } from "@/lib/ci-lookup";
import { createOperationDocument } from "@/lib/operation-document";
import { findOpenPutawayOperation } from "@/lib/operation-tasks";
import { auth } from "@/lib/auth";
import { TSD_WORKFLOW_EVENTS } from "@/lib/workflow/events";
import {
  applyOperationWorkflowTransition,
  resolveOperationPostStatus,
} from "@/lib/workflow/tsd";

export async function POST(request: NextRequest) {
  const unauthorized = await requireTsdAuth(request);
  if (unauthorized) return unauthorized;
  const denied = await requireTsdPermission("tsd.putaway");
  if (denied) return denied;

  const body = await request.json();
  const palletCode = String(body.palletCode || body.tnCode || "").trim();
  const palletIdIn = String(body.palletId || "").trim();
  const overrideLocCode = String(body.locationCode || "").trim();
  const sessionId = String(body.sessionId || "").trim() || null;

  const pallet = await findActivePalletByIdOrCode({
    id: palletIdIn,
    code: palletCode,
  });
  if (!pallet) return jsonApiError("palletNotFound", 404);
  if (pallet.status !== "ACCEPTED") {
    return jsonApiError("palletNotAccepted");
  }

  const balances = await prisma.stockBalance.findMany({
    where: { palletId: pallet.id, quantity: { gt: 0 } },
    include: { product: true },
  });
  if (balances.length === 0) return jsonApiError("palletNoStock");

  const fromLocationId = pallet.locationId ?? balances[0]?.locationId;
  if (!fromLocationId) return jsonApiError("palletCurrentLocationUnknown");

  let toLocationId: string | null = null;
  let reason = "";

  if (overrideLocCode) {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!(settings?.putawayAllowOverride ?? true)) {
      return jsonApiError("putawayManualOverrideForbidden");
    }
    const resolved = await resolveTsdLocation(overrideLocCode, "putaway");
    if (!resolved.ok) {
      return jsonError(resolved.error, resolved.notFound ? 404 : 400);
    }
    toLocationId = resolved.location.id;
    reason = "Ручной выбор";
  } else {
    const plan = await planPutawayForPallet(pallet.id);
    if (!plan) return jsonApiError("putawayPlanFailed");
    const planned = await prisma.location.findUnique({
      where: { id: plan.locationId },
      include: { zone: true },
    });
    const plannedType = planned?.zone?.type ?? planned?.type;
    if (plannedType !== "STORAGE") {
      return jsonApiError("putawayPlannedNotStorage");
    }
    toLocationId = plan.locationId;
    reason = plan.reason;
  }

  if (toLocationId === fromLocationId) {
    return jsonApiError("palletAlreadyAtTarget");
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const inboundIds = await findInboundDocumentIdsForPallet(pallet.id);
  const inboundDocumentId = inboundIds[0] ?? null;

  const moved = await prisma.$transaction(async (tx) => {
    const openPutaway = await findOpenPutawayOperation(tx, pallet.id);
    const now = new Date();

    let op;
    if (openPutaway) {
      await tx.operationLine.deleteMany({ where: { documentId: openPutaway.id } });
      op = await tx.operationDocument.update({
        where: { id: openPutaway.id },
        data: {
          createdByUserId: userId ?? openPutaway.createdByUserId,
          inboundDocumentId: inboundDocumentId ?? openPutaway.inboundDocumentId,
          sessionId: sessionId ?? openPutaway.sessionId,
          fromLocationId,
          toLocationId,
          notes: reason || openPutaway.notes,
          lines: {
            create: balances.map((b, i) => ({
              productId: b.productId,
              quantity: b.quantity,
              packageId: b.packageId,
              lotId: b.lotId,
              palletId: pallet.id,
              fromLocationId,
              toLocationId,
              lineNo: i + 1,
            })),
          },
        },
      });
      const wf = await applyOperationWorkflowTransition(tx, openPutaway.id, {
        event: TSD_WORKFLOW_EVENTS.operation.complete,
        triggerKind: "tsd",
        source: "tsd",
        note: reason || undefined,
        userId,
      });
      if (!wf.applied) {
        const postStatus = await resolveOperationPostStatus(openPutaway.status);
        op = await tx.operationDocument.update({
          where: { id: openPutaway.id },
          data: { status: postStatus, postedAt: now },
        });
      }
    } else {
      const postStatus = await resolveOperationPostStatus("RELEASED");
      op = await createOperationDocument(tx, {
        type: "PUTAWAY",
        status: postStatus as "POSTED" | "COMPLETED",
        createdByUserId: userId,
        inboundDocumentId,
        palletId: pallet.id,
        sessionId,
        fromLocationId,
        toLocationId,
        notes: reason || `Размещение ТН ${pallet.code}`,
        lines: balances.map((b) => ({
          productId: b.productId,
          quantity: b.quantity,
          packageId: b.packageId,
          lotId: b.lotId,
          palletId: pallet.id,
          fromLocationId,
          toLocationId,
        })),
      });
    }

    const n = await transferPalletStock(
      tx,
      pallet.id,
      fromLocationId,
      toLocationId!,
      "OperationDocument",
      op.id,
    );
    await tx.pallet.update({
      where: { id: pallet.id },
      data: { status: "PLACED" },
    });
    if (sessionId) {
      await tx.tsdTaskSession.updateMany({
        where: { id: sessionId },
        data: {
          status: "closed",
          closedAt: new Date(),
          palletId: pallet.id,
          plannedLocId: toLocationId,
          locationId: toLocationId,
        },
      });
    }
    return { n, op };
  });

  await enqueueOutbox({
    eventType: "stock.putaway",
    aggregateType: "Pallet",
    aggregateId: pallet.id,
    payload: {
      palletId: pallet.id,
      fromLocationId,
      toLocationId,
      lines: moved.n,
      reason,
      operationDocumentId: moved.op.id,
      operationNumber: moved.op.number,
    },
  });

  const toLoc = await prisma.location.findUnique({ where: { id: toLocationId! } });

  const docIds = await findInboundDocumentIdsForPallet(pallet.id);
  const placedDocs: string[] = [];
  for (const docId of docIds) {
    const result = await tryPlaceInboundAfterPutaway(docId);
    if (result.placed && result.number) placedDocs.push(result.number);
  }

  return jsonOk({
    ok: true,
    moved: moved.n,
    reason,
    location: toLoc,
    inboundPlaced: placedDocs,
    operation: {
      id: moved.op.id,
      number: moved.op.number,
      type: moved.op.type,
    },
  });
}
