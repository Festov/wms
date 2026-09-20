import { listStatuses, type StatusStream } from "@/lib/status";
import { statusLabelFallback } from "@/lib/status/labels";
import { inboundStatusOptions } from "@/lib/inbound-status";
import { outboundStatusOptions } from "@/lib/outbound-status";
import {
  getManualTransitions,
  loadWorkflowForEntity,
  type ManualTransitionOption,
} from "@/lib/workflow/engine";

export type DocumentStatusTransition = {
  transitionId: string;
  toStatusCode: string;
  label: string;
};

function statusStreamForEntity(entityCode: string): StatusStream | undefined {
  if (entityCode === "inbound" || entityCode === "outbound") {
    return entityCode;
  }
  return undefined;
}

export async function documentStatusTransitionsForUi(
  entityCode: string,
  documentId: string,
  currentStatus: string,
  lineCount = 0,
): Promise<DocumentStatusTransition[]> {
  const normalizedStatus = currentStatus === "COMPLETED" ? "PLACED" : currentStatus;
  const workflow = await loadWorkflowForEntity(entityCode);

  if (workflow) {
    const transitions = await getManualTransitions(entityCode, currentStatus, {
      documentId,
      lineCount,
      entityCode,
    });
    return transitions.map((transition) => ({
      transitionId: transition.transitionId,
      toStatusCode: transition.toStatusCode,
      label: transition.label,
    }));
  }

  let statusCodes: string[] = [normalizedStatus];
  if (entityCode === "inbound") {
    statusCodes = await inboundStatusOptions(normalizedStatus, {
      documentId,
      lineCount,
    });
  } else if (entityCode === "outbound") {
    statusCodes = await outboundStatusOptions(normalizedStatus, { lineCount });
  }

  const catalog = await listStatuses(statusStreamForEntity(entityCode));
  const allowed = new Set(catalog.map((status) => status.code));

  return statusCodes
    .filter((code) => code !== normalizedStatus && code !== currentStatus)
    .filter((code) => allowed.has(code))
    .map((toStatusCode) => ({
      transitionId: "",
      toStatusCode,
      label: statusLabelFallback(toStatusCode),
    }));
}

export type { ManualTransitionOption };
