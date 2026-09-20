import { prisma } from "@/lib/db";
import { findInboundDocumentIdsForPallet } from "@/lib/inbound-place";
import {
  createOperationDocument,
  type OpLineInput,
} from "@/lib/operation-document";
import type { Prisma } from "@/generated/prisma/client";

/** Статусы незавершённой складской задачи. */
export const OPEN_OPERATION_STATUSES = ["DRAFT", "RELEASED"] as const;

export const OPERATION_DONE_STATUSES = ["POSTED", "COMPLETED", "PLACED"] as const;

export async function findOpenPutawayOperation(
  db: Prisma.TransactionClient | typeof prisma,
  palletId: string,
) {
  return db.operationDocument.findFirst({
    where: {
      palletId,
      type: "PUTAWAY",
      status: { in: [...OPEN_OPERATION_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function putawayLinesForPallet(
  palletId: string,
  fromLocationId: string | null,
): Promise<OpLineInput[]> {
  const balances = await prisma.stockBalance.findMany({
    where: { palletId, quantity: { gt: 0 } },
  });
  return balances.map((b) => ({
    productId: b.productId,
    quantity: b.quantity,
    packageId: b.packageId,
    lotId: b.lotId,
    palletId,
    fromLocationId,
    toLocationId: null,
  }));
}

/** Создать задачу размещения для принятой ТН (идемпотентно). */
export async function ensurePutawayTaskForPallet(
  palletId: string,
  opts?: { inboundDocumentId?: string | null },
) {
  const pallet = await prisma.pallet.findUnique({
    where: { id: palletId },
    include: {
      balances: { where: { quantity: { gt: 0 } } },
    },
  });
  if (!pallet?.isActive || pallet.status !== "ACCEPTED") return null;
  if (pallet.balances.length === 0) return null;

  const existing = await findOpenPutawayOperation(prisma, palletId);
  if (existing) return existing;

  const inboundDocumentId =
    opts?.inboundDocumentId ??
    (await findInboundDocumentIdsForPallet(palletId))[0] ??
    null;
  const fromLocationId =
    pallet.locationId ?? pallet.balances[0]?.locationId ?? null;
  const lines = await putawayLinesForPallet(palletId, fromLocationId);
  if (lines.length === 0) return null;

  return prisma.$transaction((tx) =>
    createOperationDocument(tx, {
      type: "PUTAWAY",
      status: "RELEASED",
      inboundDocumentId,
      palletId: pallet.id,
      fromLocationId,
      notes: `Размещение ТН ${pallet.code}`,
      lines,
    }),
  );
}

/** Синхронизировать задачи размещения для всех ТН в очереди. */
export async function syncPendingPutawayTasks() {
  const pallets = await prisma.pallet.findMany({
    where: {
      isActive: true,
      status: "ACCEPTED",
      balances: { some: { quantity: { gt: 0 } } },
    },
    select: { id: true },
  });

  let created = 0;
  for (const { id } of pallets) {
    const before = await findOpenPutawayOperation(prisma, id);
    const after = await ensurePutawayTaskForPallet(id);
    if (!before && after) created += 1;
  }
  return created;
}
