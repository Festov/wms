import type { PrismaClient } from "@/generated/prisma/client";
import { serializeLabelsJson } from "@/lib/i18n/resolve-label";

export type StatusSeed = {
  code: string;
  name: string;
  nameEn?: string;
  sortOrder: number;
  colorBg?: string;
  colorFg?: string;
  colorBorder?: string;
  forInbound?: boolean;
  forOutbound?: boolean;
  forPutaway?: boolean;
  forPallet?: boolean;
  forTransfer?: boolean;
};

/** Предопределённые статусы документов и операций. */
export const PREDEFINED_STATUSES: StatusSeed[] = [
  {
    code: "DRAFT",
    name: "Новый",
    nameEn: "New",
    sortOrder: 10,
    colorBg: "#fff7ed",
    colorFg: "#9a3412",
    colorBorder: "#fdba74",
    forInbound: true,
    forOutbound: true,
    forPutaway: true,
    forTransfer: true,
  },
  {
    code: "RELEASED",
    name: "К исполнению",
    nameEn: "Released",
    sortOrder: 20,
    colorBg: "#eff6ff",
    colorFg: "#1d4ed8",
    colorBorder: "#93c5fd",
    forInbound: true,
    forOutbound: true,
    forPutaway: true,
  },
  {
    code: "AVAILABLE",
    name: "Свободен",
    nameEn: "Available",
    sortOrder: 25,
    colorBg: "#eff6ff",
    colorFg: "#1d4ed8",
    colorBorder: "#93c5fd",
    forPallet: true,
  },
  {
    code: "ACCEPTED",
    name: "Принят",
    nameEn: "Accepted",
    sortOrder: 30,
    colorBg: "#f0fdf4",
    colorFg: "#15803d",
    colorBorder: "#86efac",
    forInbound: true,
    forPallet: true,
  },
  {
    code: "PLACED",
    name: "Размещён",
    nameEn: "Placed",
    sortOrder: 40,
    colorBg: "#ecfdf5",
    colorFg: "#065f46",
    colorBorder: "#6ee7b7",
    forInbound: true,
    forPallet: true,
    forPutaway: true,
  },
  {
    code: "COMPLETED",
    name: "Завершён",
    nameEn: "Completed",
    sortOrder: 45,
    colorBg: "#ecfdf5",
    colorFg: "#065f46",
    colorBorder: "#6ee7b7",
    forInbound: true,
    forPutaway: true,
    forTransfer: true,
  },
  {
    code: "POSTED",
    name: "Проведён",
    nameEn: "Posted",
    sortOrder: 50,
    colorBg: "#ecfdf5",
    colorFg: "#065f46",
    colorBorder: "#6ee7b7",
    forOutbound: true,
    forPutaway: true,
    forTransfer: true,
  },
  {
    code: "CANCELLED",
    name: "Отменён",
    nameEn: "Cancelled",
    sortOrder: 90,
    colorBg: "#fff1f2",
    colorFg: "#9f1239",
    colorBorder: "#fda4af",
    forInbound: true,
    forOutbound: true,
    forPutaway: true,
    forPallet: true,
    forTransfer: true,
  },
];

export async function ensureStatuses(prisma: PrismaClient) {
  for (const s of PREDEFINED_STATUSES) {
    const labelsJson = serializeLabelsJson({
      ru: s.name,
      en: s.nameEn,
    });
    await prisma.status.upsert({
      where: { code: s.code },
      create: {
        code: s.code,
        name: s.name,
        labelsJson,
        sortOrder: s.sortOrder,
        colorBg: s.colorBg ?? null,
        colorFg: s.colorFg ?? null,
        colorBorder: s.colorBorder ?? null,
        isSystem: true,
        isActive: true,
        forInbound: Boolean(s.forInbound),
        forOutbound: Boolean(s.forOutbound),
        forPutaway: Boolean(s.forPutaway),
        forPallet: Boolean(s.forPallet),
        forTransfer: Boolean(s.forTransfer),
      },
      update: {
        name: s.name,
        labelsJson,
        sortOrder: s.sortOrder,
        isSystem: true,
        forInbound: Boolean(s.forInbound),
        forOutbound: Boolean(s.forOutbound),
        forPutaway: Boolean(s.forPutaway),
        forPallet: Boolean(s.forPallet),
        forTransfer: Boolean(s.forTransfer),
      },
    });
  }

  for (const s of PREDEFINED_STATUSES) {
    if (!s.colorBg && !s.colorFg && !s.colorBorder) continue;
    await prisma.status.updateMany({
      where: {
        code: s.code,
        colorBg: null,
        colorFg: null,
        colorBorder: null,
      },
      data: {
        colorBg: s.colorBg ?? null,
        colorFg: s.colorFg ?? null,
        colorBorder: s.colorBorder ?? null,
      },
    });
  }

  const { ensureStatusWorkflows } = await import("@/lib/workflow/seed");
  await ensureStatusWorkflows(prisma);
}
