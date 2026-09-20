import { prisma } from "@/lib/db";
import { docDetailPath } from "@/lib/meta/document-paths";
import type { MovementView } from "@/lib/movement-summary";

export type MovementWithId = MovementView & { id: string };

/** Синхронная ссылка по полям движения (без fallback на каталог ТН). */
export function movementTaskHref(m: MovementView): string | null {
  const ref = m.referenceType?.trim();
  const id = m.referenceId?.trim();

  if (ref && id) {
    switch (ref) {
      case "InboundDocument":
        return docDetailPath("inbound", id);
      case "OutboundDocument":
        return docDetailPath("outbound", id);
      case "OperationDocument":
      case "PUTAWAY":
      case "TSD_TRANSFER":
        return docDetailPath("operation", id);
    }
  }

  if (ref === "ADJUSTMENT") return "/inventory";

  return null;
}

/** Проверяет документы и подбирает операцию по ТН для старых движений. */
export async function resolveMovementTaskHrefs(movements: MovementWithId[]) {
  const opIds = new Set<string>();
  for (const m of movements) {
    const href = movementTaskHref(m);
    if (href?.startsWith("/doc/operation/")) {
      opIds.add(href.slice("/doc/operation/".length));
    }
  }

  const palletIds = [
    ...new Set(
      movements.map((m) => m.palletId).filter((id): id is string => Boolean(id)),
    ),
  ];

  const [existingOps, palletOps] = await Promise.all([
    opIds.size > 0
      ? prisma.operationDocument.findMany({
          where: { id: { in: [...opIds] } },
          select: { id: true },
        })
      : Promise.resolve([]),
    palletIds.length > 0
      ? prisma.operationDocument.findMany({
          where: { palletId: { in: palletIds } },
          orderBy: { createdAt: "desc" },
          select: { id: true, palletId: true },
        })
      : Promise.resolve([]),
  ]);

  const validOpIds = new Set(existingOps.map((o) => o.id));
  const latestOpByPallet = new Map<string, string>();
  for (const op of palletOps) {
    if (op.palletId && !latestOpByPallet.has(op.palletId)) {
      latestOpByPallet.set(op.palletId, op.id);
    }
  }

  const result = new Map<string, string>();
  for (const m of movements) {
    const direct = movementTaskHref(m);
    if (direct?.startsWith("/doc/operation/")) {
      const opId = direct.slice("/doc/operation/".length);
      if (validOpIds.has(opId)) {
        result.set(m.id, direct);
        continue;
      }
    } else if (direct) {
      result.set(m.id, direct);
      continue;
    }

    if (m.palletId) {
      const opId = latestOpByPallet.get(m.palletId);
      if (opId) result.set(m.id, docDetailPath("operation", opId));
    }
  }

  return result;
}
