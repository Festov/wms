import { prisma } from "@/lib/db";
import { ensureStatuses } from "@/lib/status/seed";

export type StatusStream =
  | "inbound"
  | "outbound"
  | "putaway"
  | "pallet"
  | "transfer";

const STREAM_FIELD: Record<
  StatusStream,
  "forInbound" | "forOutbound" | "forPutaway" | "forPallet" | "forTransfer"
> = {
  inbound: "forInbound",
  outbound: "forOutbound",
  putaway: "forPutaway",
  pallet: "forPallet",
  transfer: "forTransfer",
};

export { statusLabelFallback } from "@/lib/status/labels";

export async function listStatuses(stream?: StatusStream) {
  await ensureStatuses(prisma);
  const where = stream
    ? { isActive: true, [STREAM_FIELD[stream]]: true }
    : { isActive: true };
  return prisma.status.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function getStatusName(code: string | null | undefined) {
  if (!code) return "—";
  await ensureStatuses(prisma);
  const row = await prisma.status.findUnique({ where: { code } });
  return row?.name ?? code;
}
