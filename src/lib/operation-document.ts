import type { AppLocale } from "@/i18n/config";
import type { OperationDocType, Prisma } from "@/generated/prisma/client";
import { translateSyncWithFallback } from "@/lib/i18n/sync";

const OPERATION_TYPE_CODES = [
  "RECEIVE_REPORT",
  "PUTAWAY",
  "TRANSFER",
  "PICK",
] as const satisfies readonly OperationDocType[];

export const OPERATION_TYPES = [...OPERATION_TYPE_CODES] as OperationDocType[];

export function operationTypeLabel(
  type: string,
  locale: AppLocale = "ru",
) {
  return translateSyncWithFallback(
    `documents.operationTypes.${type}`,
    type,
    locale,
  );
}

function pad(n: number, width = 5) {
  return String(n).padStart(width, "0");
}

/** Следующий номер документа операции: RR-00001 / PW-00001 … */
export async function allocateOperationNumber(
  tx: Prisma.TransactionClient,
  type: OperationDocType,
) {
  const prefix =
    type === "RECEIVE_REPORT"
      ? "RR"
      : type === "PUTAWAY"
        ? "PW"
        : type === "TRANSFER"
          ? "TR"
          : "PK";
  const last = await tx.operationDocument.findFirst({
    where: { number: { startsWith: `${prefix}-` } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  let next = 1;
  if (last?.number) {
    const m = last.number.match(/-(\d+)$/);
    if (m) next = Number(m[1]) + 1;
  }
  // uniqueness retry
  for (let i = 0; i < 20; i++) {
    const number = `${prefix}-${pad(next + i)}`;
    const clash = await tx.operationDocument.findUnique({ where: { number } });
    if (!clash) return number;
  }
  return `${prefix}-${pad(next)}-${Date.now().toString(36)}`;
}

export type OpLineInput = {
  productId: string;
  quantity: number;
  packageId?: string | null;
  packageQty?: number | null;
  lotId?: string | null;
  palletId?: string | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  note?: string | null;
};

export async function createOperationDocument(
  tx: Prisma.TransactionClient,
  input: {
    type: OperationDocType;
    status?: string;
    createdByUserId?: string | null;
    inboundDocumentId?: string | null;
    palletId?: string | null;
    sessionId?: string | null;
    fromLocationId?: string | null;
    toLocationId?: string | null;
    notes?: string | null;
    lines: OpLineInput[];
  },
) {
  const number = await allocateOperationNumber(tx, input.type);
  const status = input.status ?? "DRAFT";
  const posted =
    status === "POSTED" || status === "COMPLETED" || status === "PLACED";

  return tx.operationDocument.create({
    data: {
      number,
      type: input.type,
      status,
      createdByUserId: input.createdByUserId ?? null,
      inboundDocumentId: input.inboundDocumentId ?? null,
      palletId: input.palletId ?? null,
      sessionId: input.sessionId ?? null,
      fromLocationId: input.fromLocationId ?? null,
      toLocationId: input.toLocationId ?? null,
      notes: input.notes ?? null,
      postedAt: posted ? new Date() : null,
      lines: {
        create: input.lines.map((line, index) => ({
          productId: line.productId,
          quantity: line.quantity,
          packageId: line.packageId ?? null,
          packageQty: line.packageQty ?? null,
          lotId: line.lotId ?? null,
          palletId: line.palletId ?? null,
          fromLocationId: line.fromLocationId ?? null,
          toLocationId: line.toLocationId ?? null,
          note: line.note ?? null,
          lineNo: index + 1,
        })),
      },
    },
  });
}
