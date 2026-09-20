import { prisma } from "@/lib/db";
import { assertInboundReadyToPlace } from "@/lib/inbound-place";
import { ensureStatusWorkflows } from "@/lib/workflow/seed";
import {
  parseGuardConfig,
  parseTriggerConfig,
  type TransitionGuard,
  type TriggerKind,
  type WorkflowTransitionContext,
  type WorkflowTransitionView,
} from "@/lib/workflow/types";

export type LoadedWorkflow = {
  id: string;
  code: string;
  name: string;
  entityCode: string | null;
  appliesTo: string;
  transitions: WorkflowTransitionView[];
};

function mapTransition(
  row: {
    id: string;
    fromStatusCode: string | null;
    toStatusCode: string;
    guardConfig: string | null;
    triggers: Array<{
      id: string;
      kind: string;
      label: string | null;
      config: string | null;
      requiredPerm: string | null;
      sortOrder: number;
    }>;
  },
): WorkflowTransitionView {
  return {
    id: row.id,
    fromStatusCode: row.fromStatusCode,
    toStatusCode: row.toStatusCode,
    guard: parseGuardConfig(row.guardConfig),
    triggers: row.triggers
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t) => ({
        id: t.id,
        kind: t.kind as TriggerKind,
        label: t.label,
        config: parseTriggerConfig(t.config),
        requiredPerm: t.requiredPerm,
      })),
  };
}

export async function loadWorkflowForEntity(
  entityCode: string,
): Promise<LoadedWorkflow | null> {
  await ensureStatusWorkflows(prisma);
  const row = await prisma.statusWorkflow.findFirst({
    where: { entityCode, isActive: true },
    include: {
      transitions: {
        orderBy: [{ sortOrder: "asc" }, { toStatusCode: "asc" }],
        include: { triggers: true },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    entityCode: row.entityCode,
    appliesTo: row.appliesTo,
    transitions: row.transitions.map(mapTransition),
  };
}

export async function evaluateGuard(
  guard: TransitionGuard,
  context: WorkflowTransitionContext,
): Promise<boolean> {
  if (guard === "none") return true;
  if (guard === "hasLines") {
    return (context.lineCount ?? 0) > 0;
  }
  if (guard === "readyToPlace" || guard === "allLinesPlaced") {
    if (!context.documentId) return false;
    try {
      await assertInboundReadyToPlace(context.documentId);
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

function matchesFrom(
  transition: WorkflowTransitionView,
  fromStatus: string,
) {
  const from = transition.fromStatusCode;
  if (!from) return false;
  if (from === fromStatus) return true;
  if (fromStatus === "COMPLETED" && from === "PLACED") return true;
  return false;
}

export type ManualTransitionOption = {
  transitionId: string;
  triggerId: string;
  toStatusCode: string;
  label: string;
  requiredPerm: string | null;
};

export async function getManualTransitions(
  entityCode: string,
  fromStatus: string,
  context: WorkflowTransitionContext = {},
): Promise<ManualTransitionOption[]> {
  const workflow = await loadWorkflowForEntity(entityCode);
  if (!workflow) return [];

  const options: ManualTransitionOption[] = [];

  for (const transition of workflow.transitions) {
    if (!matchesFrom(transition, fromStatus)) continue;
    if (!(await evaluateGuard(transition.guard, context))) continue;

    for (const trigger of transition.triggers) {
      if (trigger.kind !== "manual") continue;
      const toStatusCode =
        transition.toStatusCode === "COMPLETED"
          ? "PLACED"
          : transition.toStatusCode;
      if (toStatusCode === fromStatus) continue;
      options.push({
        transitionId: transition.id,
        triggerId: trigger.id,
        toStatusCode,
        label: trigger.label ?? toStatusCode,
        requiredPerm: trigger.requiredPerm,
      });
    }
  }

  return options;
}

export async function getManualTargetStatuses(
  entityCode: string,
  fromStatus: string,
  context: WorkflowTransitionContext = {},
): Promise<string[]> {
  const workflow = await loadWorkflowForEntity(entityCode);
  if (!workflow) return [fromStatus];

  const normalizedFrom = fromStatus === "COMPLETED" ? "PLACED" : fromStatus;
  const targets = new Set<string>([normalizedFrom]);

  for (const transition of workflow.transitions) {
    if (!matchesFrom(transition, fromStatus)) continue;
    const hasManual = transition.triggers.some((t) => t.kind === "manual");
    if (!hasManual) continue;
    if (!(await evaluateGuard(transition.guard, context))) continue;
    targets.add(
      transition.toStatusCode === "COMPLETED"
        ? "PLACED"
        : transition.toStatusCode,
    );
  }

  return [...targets];
}

export async function isTransitionAllowed(
  entityCode: string,
  fromStatus: string,
  toStatus: string,
  triggerKind: TriggerKind,
  context: WorkflowTransitionContext = {},
  event?: string,
): Promise<boolean> {
  const workflow = await loadWorkflowForEntity(entityCode);
  if (!workflow) return false;

  const resolvedTo = toStatus === "COMPLETED" ? "PLACED" : toStatus;

  for (const transition of workflow.transitions) {
    if (!matchesFrom(transition, fromStatus)) continue;
    if (
      transition.toStatusCode !== resolvedTo &&
      !(resolvedTo === "PLACED" && transition.toStatusCode === "COMPLETED")
    ) {
      continue;
    }
    const trigger = transition.triggers.find((t) => {
      if (t.kind !== triggerKind) return false;
      if (triggerKind === "tsd" || triggerKind === "integration") {
        const cfgEvent = t.config.event;
        return !event || cfgEvent === event || cfgEvent == null;
      }
      return true;
    });
    if (!trigger) continue;
    if (!(await evaluateGuard(transition.guard, context))) continue;
    return true;
  }

  return false;
}

export async function findEventTargetStatus(
  entityCode: string,
  fromStatus: string,
  event: string,
  triggerKinds: TriggerKind[],
  context: WorkflowTransitionContext = {},
): Promise<string | null> {
  const workflow = await loadWorkflowForEntity(entityCode);
  if (!workflow) return null;

  for (const transition of workflow.transitions) {
    if (!matchesFrom(transition, fromStatus)) continue;
    const match = transition.triggers.find(
      (t) =>
        triggerKinds.includes(t.kind) &&
        (t.config.event === event || t.config.event == null),
    );
    if (!match) continue;
    if (!(await evaluateGuard(transition.guard, context))) continue;
    return transition.toStatusCode;
  }
  return null;
}

export async function findTsdTargetStatus(
  entityCode: string,
  fromStatus: string,
  event: string,
  context: WorkflowTransitionContext = {},
): Promise<string | null> {
  return findEventTargetStatus(entityCode, fromStatus, event, ["tsd"], context);
}

export async function listWorkflows() {
  await ensureStatusWorkflows(prisma);
  return prisma.statusWorkflow.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    include: {
      transitions: {
        orderBy: [{ sortOrder: "asc" }, { toStatusCode: "asc" }],
        include: { triggers: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
}
