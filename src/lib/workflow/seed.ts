import type { PrismaClient } from "@/generated/prisma/client";
import {
  serializeGuardConfig,
  type TransitionGuard,
  type TriggerKind,
} from "@/lib/workflow/types";

type TransitionSeed = {
  from: string | null;
  to: string;
  guard?: TransitionGuard;
  triggers: Array<{
    kind: TriggerKind;
    label?: string;
    config?: Record<string, unknown>;
    requiredPerm?: string;
  }>;
};

type WorkflowSeed = {
  code: string;
  name: string;
  entityCode: string;
  appliesTo: "document" | "operation" | "pallet";
  transitions: TransitionSeed[];
};

const WORKFLOW_SEEDS: WorkflowSeed[] = [
  {
    code: "inbound",
    name: "Приёмка",
    entityCode: "inbound",
    appliesTo: "document",
    transitions: [
      {
        from: "DRAFT",
        to: "RELEASED",
        guard: "hasLines",
        triggers: [{ kind: "manual", label: "К исполнению" }],
      },
      {
        from: "DRAFT",
        to: "CANCELLED",
        triggers: [{ kind: "manual", label: "Отменить" }],
      },
      {
        from: "RELEASED",
        to: "DRAFT",
        triggers: [{ kind: "manual", label: "Вернуть в черновик" }],
      },
      {
        from: "RELEASED",
        to: "CANCELLED",
        triggers: [{ kind: "manual", label: "Отменить" }],
      },
      {
        from: "RELEASED",
        to: "ACCEPTED",
        triggers: [
          {
            kind: "tsd",
            label: "Принять (ТСД)",
            config: { event: "receive.complete" },
          },
        ],
      },
      {
        from: "ACCEPTED",
        to: "PLACED",
        guard: "readyToPlace",
        triggers: [
          { kind: "manual", label: "Размещён" },
          {
            kind: "auto",
            label: "Авто: все ТН размещены",
            config: { event: "putaway.complete" },
          },
        ],
      },
      {
        from: "COMPLETED",
        to: "PLACED",
        guard: "readyToPlace",
        triggers: [{ kind: "manual", label: "Размещён (legacy)" }],
      },
    ],
  },
  {
    code: "outbound",
    name: "Отгрузка",
    entityCode: "outbound",
    appliesTo: "document",
    transitions: [
      {
        from: "DRAFT",
        to: "RELEASED",
        guard: "hasLines",
        triggers: [{ kind: "manual", label: "К исполнению" }],
      },
      {
        from: "DRAFT",
        to: "CANCELLED",
        triggers: [{ kind: "manual", label: "Отменить" }],
      },
      {
        from: "RELEASED",
        to: "DRAFT",
        triggers: [{ kind: "manual", label: "Вернуть в черновик" }],
      },
      {
        from: "RELEASED",
        to: "POSTED",
        triggers: [
          { kind: "manual", label: "Провести" },
          {
            kind: "tsd",
            label: "Отбор (ТСД)",
            config: { event: "pick.complete" },
          },
        ],
      },
      {
        from: "RELEASED",
        to: "CANCELLED",
        triggers: [{ kind: "manual", label: "Отменить" }],
      },
    ],
  },
  {
    code: "operation",
    name: "Складские операции",
    entityCode: "operation",
    appliesTo: "operation",
    transitions: [
      {
        from: "DRAFT",
        to: "RELEASED",
        triggers: [{ kind: "manual", label: "К исполнению" }],
      },
      {
        from: "RELEASED",
        to: "POSTED",
        triggers: [
          { kind: "manual", label: "Выполнено" },
          { kind: "tsd", config: { event: "operation.complete" } },
        ],
      },
      {
        from: "RELEASED",
        to: "COMPLETED",
        triggers: [{ kind: "tsd", config: { event: "operation.complete" } }],
      },
      {
        from: "DRAFT",
        to: "CANCELLED",
        triggers: [{ kind: "manual", label: "Отменить" }],
      },
      {
        from: "RELEASED",
        to: "CANCELLED",
        triggers: [{ kind: "manual", label: "Отменить" }],
      },
    ],
  },
];

async function upsertTransition(
  prisma: PrismaClient,
  workflowId: string,
  seed: TransitionSeed,
  sortOrder: number,
) {
  const guardConfig = serializeGuardConfig(seed.guard ?? "none");
  const existingTransition = await prisma.statusTransition.findFirst({
    where: {
      workflowId,
      fromStatusCode: seed.from,
      toStatusCode: seed.to,
    },
  });
  const transition = existingTransition
    ? await prisma.statusTransition.update({
        where: { id: existingTransition.id },
        data: { sortOrder, guardConfig },
      })
    : await prisma.statusTransition.create({
        data: {
          workflowId,
          fromStatusCode: seed.from,
          toStatusCode: seed.to,
          sortOrder,
          guardConfig,
        },
      });

  const keepKinds = seed.triggers.map((t) => `${t.kind}:${t.label ?? ""}`);
  const existing = await prisma.statusTrigger.findMany({
    where: { transitionId: transition.id },
  });
  for (const row of existing) {
    const key = `${row.kind}:${row.label ?? ""}`;
    if (!keepKinds.includes(key)) {
      await prisma.statusTrigger.delete({ where: { id: row.id } });
    }
  }

  for (const [i, trigger] of seed.triggers.entries()) {
    const existingTrigger = await prisma.statusTrigger.findFirst({
      where: {
        transitionId: transition.id,
        kind: trigger.kind,
        label: trigger.label ?? null,
      },
    });
    const data = {
      kind: trigger.kind,
      label: trigger.label ?? null,
      config: trigger.config ? JSON.stringify(trigger.config) : null,
      requiredPerm: trigger.requiredPerm ?? null,
      sortOrder: i,
    };
    if (existingTrigger) {
      await prisma.statusTrigger.update({
        where: { id: existingTrigger.id },
        data,
      });
    } else {
      await prisma.statusTrigger.create({
        data: { transitionId: transition.id, ...data },
      });
    }
  }
}

export async function ensureStatusWorkflows(prisma: PrismaClient) {
  for (const wf of WORKFLOW_SEEDS) {
    const workflow = await prisma.statusWorkflow.upsert({
      where: { code: wf.code },
      create: {
        code: wf.code,
        name: wf.name,
        entityCode: wf.entityCode,
        appliesTo: wf.appliesTo,
        isActive: true,
      },
      update: {
        name: wf.name,
        entityCode: wf.entityCode,
        appliesTo: wf.appliesTo,
        isActive: true,
      },
    });

    for (const [i, tr] of wf.transitions.entries()) {
      await upsertTransition(prisma, workflow.id, tr, i);
    }

    const keep = wf.transitions.map(
      (t) => `${t.from ?? ""}->${t.to}`,
    );
    const all = await prisma.statusTransition.findMany({
      where: { workflowId: workflow.id },
    });
    for (const row of all) {
      const key = `${row.fromStatusCode ?? ""}->${row.toStatusCode}`;
      if (!keep.includes(key)) {
        await prisma.statusTransition.delete({ where: { id: row.id } });
      }
    }
  }
}

export { WORKFLOW_SEEDS };
