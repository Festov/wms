import { listStatuses } from "@/lib/status";
import {
  getManualTargetStatuses,
  loadWorkflowForEntity,
} from "@/lib/workflow/engine";

const OUTBOUND_FALLBACK: Record<string, string[]> = {
  DRAFT: ["DRAFT", "RELEASED", "CANCELLED"],
  RELEASED: ["RELEASED", "DRAFT", "POSTED", "CANCELLED"],
  POSTED: ["POSTED"],
  CANCELLED: ["CANCELLED"],
};

export async function outboundStatusOptions(
  current: string,
  context: { lineCount?: number } = {},
): Promise<string[]> {
  const workflow = await loadWorkflowForEntity("outbound");
  if (workflow) {
    return getManualTargetStatuses("outbound", current, {
      ...context,
      entityCode: "outbound",
    });
  }
  return OUTBOUND_FALLBACK[current] ?? [current];
}

export async function outboundStatusOptionsForUi(
  current: string,
  lineCount = 0,
): Promise<string[]> {
  const catalog = await listStatuses("outbound");
  const allowed = new Set(catalog.map((s) => s.code));
  const base = await outboundStatusOptions(current, { lineCount });
  return base.filter((s) => allowed.has(s) || s === current);
}
