import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { recordInboundStatusChange } from "@/lib/inbound-status-history";
import type { InboundStatusSource } from "@/lib/inbound-status-history";
import { recordOutboundStatusChange } from "@/lib/outbound-status-history";
import type { OutboundStatusSource } from "@/lib/outbound-status-history";
import {
  findEventTargetStatus,
  findTsdTargetStatus,
  isTransitionAllowed,
  loadWorkflowForEntity,
} from "@/lib/workflow/engine";
import { TSD_WORKFLOW_EVENTS } from "@/lib/workflow/events";
import type { TriggerKind, WorkflowTransitionContext } from "@/lib/workflow/types";

function normalizeStatus(status: string) {
  return status === "COMPLETED" ? "PLACED" : status;
}

function matchesFromStatus(fromStatusCode: string | null, current: string) {
  if (!fromStatusCode) return false;
  const normalized = normalizeStatus(current);
  if (fromStatusCode === normalized) return true;
  if (normalized === "PLACED" && fromStatusCode === "COMPLETED") return true;
  return false;
}

/** Статусы документов, из которых ТСД может инициировать переход (tsd/auto). */
export async function listTsdOpenStatuses(entityCode: string): Promise<string[]> {
  const workflow = await loadWorkflowForEntity(entityCode);
  if (!workflow) {
    if (entityCode === "inbound" || entityCode === "outbound") return ["RELEASED"];
    return [];
  }
  const codes = new Set<string>();
  for (const tr of workflow.transitions) {
    if (!tr.fromStatusCode) continue;
    if (tr.triggers.some((t) => t.kind === "tsd" || t.kind === "auto")) {
      codes.add(tr.fromStatusCode);
    }
  }
  return [...codes];
}

/** Документ доступен для операций ТСД в текущем статусе. */
export async function isDocumentOpenForTsd(
  entityCode: string,
  status: string,
): Promise<boolean> {
  const open = await listTsdOpenStatuses(entityCode);
  return open.includes(normalizeStatus(status));
}

type ApplyOptions = {
  event: string;
  triggerKind: TriggerKind;
  source: InboundStatusSource | OutboundStatusSource;
  note?: string;
  userId?: string | null;
  context?: WorkflowTransitionContext;
  postedAt?: Date;
};

function triggerKindsFor(kind: TriggerKind): TriggerKind[] {
  if (kind === "auto") return ["auto"];
  if (kind === "tsd" || kind === "integration") return [kind];
  return [kind];
}

async function resolveWorkflowTarget(
  entityCode: string,
  fromStatus: string,
  options: ApplyOptions,
  context: WorkflowTransitionContext,
): Promise<string | null> {
  return findEventTargetStatus(
    entityCode,
    fromStatus,
    options.event,
    triggerKindsFor(options.triggerKind),
    context,
  );
}

export async function applyInboundWorkflowTransition(
  documentId: string,
  options: ApplyOptions,
): Promise<{ applied: boolean; fromStatus?: string; toStatus?: string }> {
  const doc = await prisma.inboundDocument.findUnique({ where: { id: documentId } });
  if (!doc) return { applied: false };

  const context: WorkflowTransitionContext = {
    documentId,
    entityCode: "inbound",
    ...options.context,
  };

  const target = await resolveWorkflowTarget("inbound", doc.status, options, context);
  if (!target) return { applied: false, fromStatus: doc.status };

  const allowed = await isTransitionAllowed(
    "inbound",
    doc.status,
    target,
    options.triggerKind,
    context,
    options.event,
  );
  if (!allowed) return { applied: false, fromStatus: doc.status };

  const resolvedTo = target === "COMPLETED" ? "PLACED" : target;
  const fromStatus = doc.status;

  await prisma.$transaction(async (tx) => {
    await tx.inboundDocument.update({
      where: { id: documentId },
      data: {
        status: resolvedTo as "DRAFT" | "RELEASED" | "CANCELLED" | "ACCEPTED" | "PLACED",
        ...(resolvedTo === "ACCEPTED" || resolvedTo === "PLACED"
          ? { postedAt: options.postedAt ?? new Date() }
          : {}),
      },
    });
    await recordInboundStatusChange(tx, {
      documentId,
      fromStatus,
      toStatus: resolvedTo,
      changedById: options.userId ?? null,
      source: options.source,
      note: options.note,
    });
  });

  return { applied: true, fromStatus, toStatus: resolvedTo };
}

export async function applyOutboundWorkflowTransition(
  documentId: string,
  options: ApplyOptions,
): Promise<{ applied: boolean; fromStatus?: string; toStatus?: string }> {
  const doc = await prisma.outboundDocument.findUnique({ where: { id: documentId } });
  if (!doc) return { applied: false };

  const context: WorkflowTransitionContext = {
    documentId,
    entityCode: "outbound",
    ...options.context,
  };

  const target = await resolveWorkflowTarget("outbound", doc.status, options, context);
  if (!target) return { applied: false, fromStatus: doc.status };

  const allowed = await isTransitionAllowed(
    "outbound",
    doc.status,
    target,
    options.triggerKind,
    context,
    options.event,
  );
  if (!allowed) return { applied: false, fromStatus: doc.status };

  const fromStatus = doc.status;

  await prisma.$transaction(async (tx) => {
    await tx.outboundDocument.update({
      where: { id: documentId },
      data: { status: target },
    });
    await recordOutboundStatusChange(tx, {
      documentId,
      fromStatus,
      toStatus: target,
      changedById: options.userId ?? null,
      source: options.source,
      note: options.note,
    });
  });

  return { applied: true, fromStatus, toStatus: target };
}

/** Завершить операционный документ по workflow (ТСД). */
export async function applyOperationWorkflowTransition(
  tx: Prisma.TransactionClient,
  operationId: string,
  options: Pick<ApplyOptions, "event" | "triggerKind" | "source" | "note" | "userId">,
): Promise<{ applied: boolean; toStatus?: string }> {
  const op = await tx.operationDocument.findUnique({ where: { id: operationId } });
  if (!op) return { applied: false };

  const target = await findTsdTargetStatus(
    "operation",
    op.status,
    options.event,
    { entityCode: "operation" },
  );
  if (!target) return { applied: false };

  const allowed = await isTransitionAllowed(
    "operation",
    op.status,
    target,
    options.triggerKind,
    { entityCode: "operation" },
    options.event,
  );
  if (!allowed) return { applied: false };

  await tx.operationDocument.update({
    where: { id: operationId },
    data: {
      status: target,
      postedAt: target === "POSTED" || target === "COMPLETED" ? new Date() : undefined,
    },
  });

  return { applied: true, toStatus: target };
}

export async function resolveOperationPostStatus(
  fromStatus: string,
): Promise<string> {
  const target = await findTsdTargetStatus(
    "operation",
    fromStatus,
    TSD_WORKFLOW_EVENTS.operation.complete,
    { entityCode: "operation" },
  );
  return target ?? "POSTED";
}

export { matchesFromStatus, normalizeStatus };
