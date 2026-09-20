import { prisma } from "@/lib/db";
import {
  getMetaEntity,
  listRefOptions,
  type MetaEntityFull,
} from "@/lib/meta/catalog";
import { enumLabel } from "@/lib/format";

export type DocumentExtraAttr = MetaEntityFull["attributes"][number];

function valueFromForm(type: string, raw: FormDataEntryValue | null) {
  const s = String(raw ?? "").trim();
  if (type === "bool") return raw === "on" || raw === "true";
  if (type === "number") return s ? Number(s) : null;
  if (!s) return null;
  return s;
}

/** Несистемные (пользовательские) атрибуты документа. */
export async function getDocumentExtraAttributes(entityCode: string) {
  const entity = await getMetaEntity(entityCode);
  if (!entity) return { entity: null, attributes: [] as DocumentExtraAttr[] };
  const attributes = entity.attributes.filter(
    (a) => !a.systemField && !a.isSystem,
  );
  return { entity, attributes };
}

export async function getDocumentExtraValues(
  entityCode: string,
  documentId: string,
) {
  const { entity, attributes } = await getDocumentExtraAttributes(entityCode);
  if (!entity || attributes.length === 0) {
    return { entity, attributes, values: {} as Record<string, unknown> };
  }

  const record = await prisma.metaRecord.findUnique({
    where: { entityId_code: { entityId: entity.id, code: documentId } },
    include: { values: { include: { attribute: true } } },
  });

  const values: Record<string, unknown> = {};
  if (record) {
    for (const v of record.values) {
      values[v.attribute.code] =
        v.valueText ??
        v.valueNumber ??
        v.valueBool ??
        (v.valueDate ? v.valueDate.toISOString().slice(0, 10) : null);
    }
  }
  return { entity, attributes, values };
}

/** Сохранить доп. реквизиты документа из FormData. */
export async function saveDocumentExtraValues(
  entityCode: string,
  documentId: string,
  formData: FormData,
  title?: string,
) {
  const { entity, attributes } = await getDocumentExtraAttributes(entityCode);
  if (!entity || attributes.length === 0) return;

  const data: Record<string, unknown> = {};
  for (const attr of attributes) {
    data[attr.code] = valueFromForm(attr.type, formData.get(attr.code));
  }

  let record = await prisma.metaRecord.findUnique({
    where: { entityId_code: { entityId: entity.id, code: documentId } },
  });
  if (!record) {
    record = await prisma.metaRecord.create({
      data: {
        entityId: entity.id,
        code: documentId,
        title: title ?? documentId,
      },
    });
  } else if (title) {
    record = await prisma.metaRecord.update({
      where: { id: record.id },
      data: { title },
    });
  }

  for (const attr of attributes) {
    const raw = data[attr.code];
    const base = {
      valueText: null as string | null,
      valueNumber: null as number | null,
      valueBool: null as boolean | null,
      valueDate: null as Date | null,
    };
    if (attr.type === "number" && raw != null && raw !== "") {
      base.valueNumber = Number(raw);
    } else if (attr.type === "bool") {
      base.valueBool = Boolean(raw);
    } else if (attr.type === "date" && raw) {
      base.valueDate = new Date(String(raw));
    } else if (raw != null && raw !== "") {
      base.valueText = String(raw);
    }

    await prisma.metaValue.upsert({
      where: {
        recordId_attributeId: {
          recordId: record.id,
          attributeId: attr.id,
        },
      },
      create: { recordId: record.id, attributeId: attr.id, ...base },
      update: base,
    });
  }
}

/** Опции ref-полей для доп. реквизитов. */
export async function loadDocumentExtraRefOptions(
  attributes: DocumentExtraAttr[],
) {
  const refOptions: Record<string, { id: string; label: string }[]> = {};
  for (const attr of attributes) {
    if (attr.type === "ref" && attr.refEntityCode) {
      refOptions[attr.code] = await listRefOptions(attr.refEntityCode);
    }
  }
  return refOptions;
}

export function formatDocumentExtraValue(
  attr: DocumentExtraAttr,
  value: unknown,
  refOptions?: { id: string; label: string }[],
) {
  if (value == null || value === "") return "—";
  if (attr.type === "bool") return value ? "Да" : "Нет";
  if (attr.type === "enum") return enumLabel(String(value));
  if (attr.type === "ref" && refOptions) {
    return refOptions.find((o) => o.id === String(value))?.label ?? String(value);
  }
  return String(value);
}
