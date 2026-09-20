import { prisma } from "@/lib/db";
import { localized } from "@/lib/i18n/errors";
import { throwLocalized } from "@/lib/i18n/errors-server";
import type { MetaLineColumn } from "@/generated/prisma/client";
import { loadLineDefinition, type MetaLineDefinitionFull } from "@/lib/meta/lines";
import { listRefOptions } from "@/lib/meta/catalog";
import type { MetaDocumentLineRow } from "@/components/meta-document-lines";

export const DEFAULT_CUSTOM_LINE_COLUMNS = [
  { code: "name", name: "Наименование", type: "string", required: true },
  { code: "qty", name: "Количество", type: "number", required: true },
] as const;

function valueFromColumn(
  col: MetaLineColumn,
  raw: FormDataEntryValue | null,
): string | number | boolean | null {
  const s = String(raw ?? "").trim();
  if (col.type === "bool") {
    return raw === "on" || raw === "true" || raw === "1";
  }
  if (col.type === "number") {
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  if (!s) return null;
  return s;
}

export function lineRowFromData(
  line: { id: string; lineNo: number; dataJson: string },
  columns: MetaLineColumn[],
  refLabels: Record<string, Record<string, string>> = {},
): MetaDocumentLineRow {
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(line.dataJson) as Record<string, unknown>;
  } catch {
    data = {};
  }

  const row: MetaDocumentLineRow = {
    id: line.id,
    lineNo: line.lineNo,
  };

  for (const col of columns) {
    const raw = data[col.code];
    if (col.type === "ref" && typeof raw === "string" && refLabels[col.code]?.[raw]) {
      row[col.code] = refLabels[col.code][raw];
      continue;
    }
    row[col.code] = raw ?? null;
  }

  return row;
}

export async function loadRefLabelsForColumns(
  columns: MetaLineColumn[],
): Promise<Record<string, Record<string, string>>> {
  const labels: Record<string, Record<string, string>> = {};
  for (const col of columns) {
    if (col.type !== "ref" || !col.refEntityCode) continue;
    const options = await listRefOptions(col.refEntityCode);
    labels[col.code] = Object.fromEntries(
      options.map((option) => [option.id, option.label]),
    );
  }
  return labels;
}

export async function loadCustomDocumentLines(
  recordId: string,
  entityCode: string,
  lineCode = "lines",
): Promise<{
  lineDef: MetaLineDefinitionFull | null;
  rows: MetaDocumentLineRow[];
  refOptions: Record<string, { id: string; label: string }[]>;
}> {
  const lineDef = await loadLineDefinition(entityCode, lineCode);
  if (!lineDef) {
    return { lineDef: null, rows: [], refOptions: {} };
  }

  const lines = await prisma.metaLineRecord.findMany({
    where: { recordId, lineDefId: lineDef.id },
    orderBy: [{ lineNo: "asc" }, { createdAt: "asc" }],
  });

  const refLabels = await loadRefLabelsForColumns(lineDef.columns);
  const refOptions: Record<string, { id: string; label: string }[]> = {};
  for (const col of lineDef.columns) {
    if (col.type === "ref" && col.refEntityCode) {
      refOptions[col.code] = await listRefOptions(col.refEntityCode);
    }
  }

  return {
    lineDef,
    rows: lines.map((line) => lineRowFromData(line, lineDef.columns, refLabels)),
    refOptions,
  };
}

export async function ensureDefaultLineDefinition(entityId: string) {
  const existing = await prisma.metaLineDefinition.findFirst({
    where: { entityId, code: "lines" },
  });
  if (existing) return existing;

  return prisma.metaLineDefinition.create({
    data: {
      entityId,
      code: "lines",
      name: "Строки",
      columns: {
        create: DEFAULT_CUSTOM_LINE_COLUMNS.map((col, index) => ({
          code: col.code,
          name: col.name,
          type: col.type,
          required: col.required,
          listVisible: true,
          sortOrder: index,
        })),
      },
    },
  });
}

export function validateLineForm(
  columns: MetaLineColumn[],
  formData: FormData,
) {
  for (const col of columns) {
    if (!col.required) continue;
    const raw = formData.get(col.code);
    if (col.type === "bool") {
      if (raw !== "on" && raw !== "true" && raw !== "1") {
        throw new Error(
          localized("errors.meta.fillField", "ru", { name: col.name }),
        );
      }
      continue;
    }
    const value = valueFromColumn(col, raw);
    if (value == null || value === "") {
      throw new Error(
        localized("errors.meta.fillField", "ru", { name: col.name }),
      );
    }
  }
}

export function lineDataFromForm(
  columns: MetaLineColumn[],
  formData: FormData,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const col of columns) {
    data[col.code] = valueFromColumn(col, formData.get(col.code));
  }
  return data;
}

export async function addCustomDocumentLine(
  entityCode: string,
  recordId: string,
  formData: FormData,
  lineCode = "lines",
) {
  const entity = await prisma.metaEntity.findUnique({
    where: { code: entityCode },
    select: { id: true },
  });
  if (!entity) return throwLocalized("errors.documents.notFound");

  const lineDef = await loadLineDefinition(entityCode, lineCode);
  if (!lineDef) return throwLocalized("errors.meta.lineSectionNotConfigured");

  validateLineForm(lineDef.columns, formData);
  const data = lineDataFromForm(lineDef.columns, formData);

  const lineCount = await prisma.metaLineRecord.count({
    where: { recordId, lineDefId: lineDef.id },
  });

  await prisma.metaLineRecord.create({
    data: {
      recordId,
      lineDefId: lineDef.id,
      lineNo: lineCount + 1,
      dataJson: JSON.stringify(data),
    },
  });
}

export async function getCustomDocumentLine(
  entityCode: string,
  recordId: string,
  lineId: string,
  lineCode = "lines",
) {
  const lineDef = await loadLineDefinition(entityCode, lineCode);
  if (!lineDef) return null;

  const line = await prisma.metaLineRecord.findFirst({
    where: { id: lineId, recordId, lineDefId: lineDef.id },
  });
  if (!line) return null;

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(line.dataJson) as Record<string, unknown>;
  } catch {
    data = {};
  }

  return { line, lineDef, data };
}

export async function updateCustomDocumentLine(
  entityCode: string,
  recordId: string,
  lineId: string,
  formData: FormData,
  lineCode = "lines",
) {
  const existing = await getCustomDocumentLine(
    entityCode,
    recordId,
    lineId,
    lineCode,
  );
  if (!existing) return throwLocalized("errors.documents.notFound");

  validateLineForm(existing.lineDef.columns, formData);
  const data = lineDataFromForm(existing.lineDef.columns, formData);

  await prisma.metaLineRecord.update({
    where: { id: lineId },
    data: { dataJson: JSON.stringify(data) },
  });
}

export async function deleteCustomDocumentLine(
  entityCode: string,
  recordId: string,
  lineId: string,
  lineCode = "lines",
) {
  const existing = await getCustomDocumentLine(
    entityCode,
    recordId,
    lineId,
    lineCode,
  );
  if (!existing) return throwLocalized("errors.documents.notFound");

  await prisma.metaLineRecord.delete({ where: { id: lineId } });

  const remaining = await prisma.metaLineRecord.findMany({
    where: { recordId, lineDefId: existing.lineDef.id },
    orderBy: [{ lineNo: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  for (let i = 0; i < remaining.length; i++) {
    await prisma.metaLineRecord.update({
      where: { id: remaining[i].id },
      data: { lineNo: i + 1 },
    });
  }
}
