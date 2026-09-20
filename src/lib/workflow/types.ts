export type WorkflowAppliesTo = "document" | "operation" | "pallet";

export type TriggerKind = "manual" | "tsd" | "auto" | "integration";

export type TransitionGuard =
  | "none"
  | "hasLines"
  | "allLinesPlaced"
  | "readyToPlace";

export type WorkflowTransitionContext = {
  documentId?: string;
  lineCount?: number;
  entityCode?: string;
};

export type WorkflowTransitionView = {
  id: string;
  fromStatusCode: string | null;
  toStatusCode: string;
  guard: TransitionGuard;
  triggers: {
    id: string;
    kind: TriggerKind;
    label: string | null;
    config: Record<string, unknown>;
    requiredPerm: string | null;
  }[];
};

export function parseGuardConfig(raw: string | null | undefined): TransitionGuard {
  if (!raw) return "none";
  try {
    const parsed = JSON.parse(raw) as { guard?: string };
    if (parsed.guard === "hasLines") return "hasLines";
    if (parsed.guard === "allLinesPlaced") return "allLinesPlaced";
    if (parsed.guard === "readyToPlace") return "readyToPlace";
    return "none";
  } catch {
    return "none";
  }
}

export function serializeGuardConfig(guard: TransitionGuard): string | null {
  if (guard === "none") return null;
  return JSON.stringify({ guard });
}

export function parseTriggerConfig(
  raw: string | null | undefined,
): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
