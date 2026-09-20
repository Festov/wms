import { prisma } from "@/lib/db";
import { throwLocalized } from "@/lib/i18n/errors-server";
import { enqueueOutbox } from "@/lib/integration/outbox";
import { TSD_WORKFLOW_EVENTS } from "@/lib/workflow/events";
import { applyInboundWorkflowTransition } from "@/lib/workflow/tsd";

/** Уникальные ТН, по которым есть факт приёмки в документе. */
export async function listInboundDocumentPalletIds(documentId: string) {
  const lines = await prisma.inboundLine.findMany({
    where: { documentId, palletId: { not: null } },
    select: { palletId: true },
  });
  return [...new Set(lines.map((l) => l.palletId!).filter(Boolean))];
}

/**
 * Документ можно перевести в «Размещён», только если все его ТН
 * в статусе PLACED и лежат в ячейках зоны хранения.
 */
export async function assertInboundReadyToPlace(documentId: string) {
  const palletIds = await listInboundDocumentPalletIds(documentId);
  if (palletIds.length === 0) {
    return throwLocalized("errors.documents.noPalletsOnDocument");
  }

  const pallets = await prisma.pallet.findMany({
    where: { id: { in: palletIds } },
    include: { location: { include: { zone: true } } },
  });

  for (const p of pallets) {
    if (p.status !== "PLACED") {
      return throwLocalized("errors.documents.palletNotPlaced", { code: p.code });
    }
    const locType = p.location?.zone?.type ?? p.location?.type;
    if (!p.locationId || locType !== "STORAGE") {
      return throwLocalized("errors.documents.palletNotInStorage", {
        code: p.code,
      });
    }
  }
}

/** После размещения ТН — если все ТН документа в хранении, статус → PLACED. */
export async function tryPlaceInboundAfterPutaway(
  documentId: string,
): Promise<{ placed: boolean; number?: string }> {
  const doc = await prisma.inboundDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc || (doc.status !== "ACCEPTED" && doc.status !== "COMPLETED")) {
    return { placed: false };
  }

  try {
    await assertInboundReadyToPlace(documentId);
  } catch {
    return { placed: false };
  }

  const transition = await applyInboundWorkflowTransition(documentId, {
    event: TSD_WORKFLOW_EVENTS.inbound.place,
    triggerKind: "auto",
    source: "system",
    note: "Все ТН размещены",
    context: { documentId },
  });
  if (!transition.applied) return { placed: false };

  await enqueueOutbox({
    eventType: "inbound.placed",
    aggregateType: "InboundDocument",
    aggregateId: documentId,
    payload: { id: documentId, number: doc.number, status: "PLACED" },
  });

  return { placed: true, number: doc.number };
}

/** Миграция старого статуса COMPLETED → PLACED у документов приёмки. */
export async function migrateInboundCompletedToPlaced() {
  // Raw SQL: обходит кэш HMR со старым DocStatus без PLACED.
  await prisma.$executeRawUnsafe(
    `UPDATE "InboundDocument" SET status = 'PLACED' WHERE status = 'COMPLETED'`,
  );
}

/** Документы приёмки, связанные с данным ТН. */
export async function findInboundDocumentIdsForPallet(palletId: string) {
  const lines = await prisma.inboundLine.findMany({
    where: { palletId },
    select: { documentId: true },
  });
  return [...new Set(lines.map((l) => l.documentId))];
}
