import { listStatuses } from "@/lib/status";
import {
  getManualTargetStatuses,
  loadWorkflowForEntity,
} from "@/lib/workflow/engine";

/** Allowed inbound document status transitions (workflow-driven). */
const INBOUND_FALLBACK: Record<string, string[]> = {
  DRAFT: ["DRAFT", "RELEASED", "CANCELLED"],
  RELEASED: ["RELEASED", "DRAFT", "CANCELLED"],
  ACCEPTED: ["ACCEPTED", "PLACED"],
  COMPLETED: ["COMPLETED", "PLACED"],
  PLACED: ["PLACED"],
  POSTED: ["POSTED"],
  CANCELLED: ["CANCELLED"],
};

export async function inboundStatusOptions(
  current: string,
  context: { documentId?: string; lineCount?: number } = {},
): Promise<string[]> {
  const workflow = await loadWorkflowForEntity("inbound");
  if (workflow) {
    return getManualTargetStatuses("inbound", current, {
      ...context,
      entityCode: "inbound",
    });
  }
  return INBOUND_FALLBACK[current] ?? [current];
}

export async function inboundStatusOptionsForUi(
  documentId: string,
  current: string,
  lineCount = 0,
): Promise<string[]> {
  const { migrateInboundCompletedToPlaced } = await import("@/lib/inbound-place");
  await migrateInboundCompletedToPlaced();

  const catalog = await listStatuses("inbound");
  const allowed = new Set(catalog.map((s) => s.code));

  let base = await inboundStatusOptions(
    current === "COMPLETED" ? "PLACED" : current,
    { documentId, lineCount },
  );
  base = [...new Set(base.map((s) => (s === "COMPLETED" ? "PLACED" : s)))].filter(
    (s) => allowed.has(s) || s === current,
  );

  return base;
}
