import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type OutboundStatusSource = "web" | "tsd" | "system";

type RecordArgs = {
  documentId: string;
  fromStatus: string | null;
  toStatus: string;
  changedById?: string | null;
  source?: OutboundStatusSource | null;
  note?: string | null;
};

type Db = Prisma.TransactionClient | typeof prisma;

export async function recordOutboundStatusChange(db: Db, args: RecordArgs) {
  if (args.fromStatus === args.toStatus) return;
  await db.outboundStatusHistory.create({
    data: {
      documentId: args.documentId,
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
      changedById: args.changedById ?? null,
      source: args.source ?? null,
      note: args.note ?? null,
    },
  });
}

export function outboundStatusSourceLabel(source: string | null | undefined) {
  switch (source) {
    case "web":
      return "Веб";
    case "tsd":
      return "ТСД";
    case "system":
      return "Система";
    default:
      return "—";
  }
}
