import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type InboundStatusSource = "web" | "tsd" | "system";

type RecordArgs = {
  documentId: string;
  fromStatus: string | null;
  toStatus: string;
  changedById?: string | null;
  source?: InboundStatusSource | null;
  note?: string | null;
};

type Db = Prisma.TransactionClient | typeof prisma;

export async function recordInboundStatusChange(db: Db, args: RecordArgs) {
  if (args.fromStatus === args.toStatus) return;
  await db.inboundStatusHistory.create({
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

export function inboundStatusSourceLabel(source: string | null | undefined) {
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
