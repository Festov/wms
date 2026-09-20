"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { throwLocalized } from "@/lib/i18n/errors-server";
import { requireAdminWrite } from "@/lib/session";
import {
  serializeGuardConfig,
  type TransitionGuard,
  type TriggerKind,
} from "@/lib/workflow/types";
import { ensureStatusWorkflows } from "@/lib/workflow/seed";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function addStatusTransition(formData: FormData) {
  await requireAdminWrite();
  await ensureStatusWorkflows(prisma);

  const workflowId = str(formData, "workflowId");
  const fromStatusCode = str(formData, "fromStatusCode") || null;
  const toStatusCode = str(formData, "toStatusCode");
  const guard = (str(formData, "guard") || "none") as TransitionGuard;
  const triggerKind = (str(formData, "triggerKind") || "manual") as TriggerKind;
  const label = str(formData, "label") || null;

  if (!workflowId || !toStatusCode) {
    return throwLocalized("errors.workflow.workflowAndStatusRequired");
  }

  const maxSort = await prisma.statusTransition.aggregate({
    where: { workflowId },
    _max: { sortOrder: true },
  });

  const transition = await prisma.statusTransition.create({
    data: {
      workflowId,
      fromStatusCode,
      toStatusCode,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 10,
      guardConfig: serializeGuardConfig(guard),
    },
  });

  await prisma.statusTrigger.create({
    data: {
      transitionId: transition.id,
      kind: triggerKind,
      label,
      config: str(formData, "event")
        ? JSON.stringify({ event: str(formData, "event") })
        : null,
      sortOrder: 0,
    },
  });

  revalidatePath("/admin/statuses");
}

export async function deleteStatusTransition(transitionId: string) {
  await requireAdminWrite();
  await prisma.statusTransition.delete({ where: { id: transitionId } });
  revalidatePath("/admin/statuses");
}

export async function deleteStatusTransitionAction(formData: FormData) {
  const transitionId = str(formData, "transitionId");
  if (!transitionId) return throwLocalized("errors.workflow.transitionNotSpecified");
  await deleteStatusTransition(transitionId);
}
