import { prisma } from "@/lib/db";
import { enqueueOutbox } from "@/lib/integration/outbox";
import { TSD_WORKFLOW_EVENTS } from "@/lib/workflow/events";
import {
  applyInboundWorkflowTransition,
  isDocumentOpenForTsd,
} from "@/lib/workflow/tsd";

/**
 * Переводит документ приёмки в «Принят», когда по всем плановым строкам
 * (без ячейки) количество уже принято на ТСД (строки с ячейкой).
 * Остатки уже увеличены при сканировании — здесь только статус.
 */
export async function tryAcceptInboundAfterTsd(
  documentId: string,
): Promise<{ accepted: boolean; number?: string }> {
  const doc = await prisma.inboundDocument.findUnique({
    where: { id: documentId },
    include: { lines: true },
  });
  if (!doc || !(await isDocumentOpenForTsd("inbound", doc.status))) {
    return { accepted: false };
  }

  const planned = new Map<string, number>();
  const received = new Map<string, number>();

  for (const line of doc.lines) {
    if (line.locationId) {
      received.set(
        line.productId,
        (received.get(line.productId) ?? 0) + line.quantity,
      );
    } else {
      planned.set(
        line.productId,
        (planned.get(line.productId) ?? 0) + line.quantity,
      );
    }
  }

  if (planned.size === 0) return { accepted: false };
  if (received.size === 0) return { accepted: false };

  for (const [productId, need] of planned) {
    if ((received.get(productId) ?? 0) + 1e-9 < need) {
      return { accepted: false };
    }
  }

  const transition = await applyInboundWorkflowTransition(documentId, {
    event: TSD_WORKFLOW_EVENTS.inbound.receive,
    triggerKind: "tsd",
    source: "tsd",
    note: "Полная приёмка по плану",
    postedAt: new Date(),
  });
  if (!transition.applied) return { accepted: false };

  await enqueueOutbox({
    eventType: "inbound.accepted",
    aggregateType: "InboundDocument",
    aggregateId: documentId,
    payload: { id: documentId, number: doc.number },
  });

  return { accepted: true, number: doc.number };
}

/** @deprecated use tryAcceptInboundAfterTsd */
export async function tryCompleteInboundAfterTsd(documentId: string) {
  const result = await tryAcceptInboundAfterTsd(documentId);
  return { posted: result.accepted, number: result.number };
}
