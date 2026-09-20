import { prisma } from "@/lib/db";
import {
  getMetaEntity,
  listRefOptions,
} from "@/lib/meta/catalog";
import {
  dateFieldValue,
  formFieldName,
  type DocumentEntityCode,
  type DocumentFormAttr,
} from "@/lib/meta/document-form-shared";
import { validateDocumentForm } from "@/lib/meta/document-form-validate";

export type {
  DocumentEntityCode,
  DocumentFieldContext,
  DocumentFormAttr,
} from "@/lib/meta/document-form-shared";

export {
  extraSectionAttributes,
  filterCreateSections,
  formatListCellValue,
  formFieldName,
  mergeDetailSections,
  enumOptionsForAttr,
  resolveDocumentFieldWidget,
} from "@/lib/meta/document-form-shared";

export { validateDocumentForm };

function isExtraAttr(attr: DocumentFormAttr) {
  return !attr.systemField && !attr.isSystem;
}

export async function getDocumentFormAttributes(entityCode: DocumentEntityCode) {
  const entity = await getMetaEntity(entityCode);
  if (!entity) {
    return { entity: null, sections: [] as { code: string; name: string; attributes: DocumentFormAttr[] }[] };
  }

  const visible = entity.attributes.filter((a) => a.formVisible);
  const sections = entity.sections
    .map((section) => ({
      code: section.code,
      name: section.name,
      attributes: visible.filter((a) => a.section?.code === section.code),
    }))
    .filter((s) => s.attributes.length > 0);

  const unsectioned = visible.filter((a) => !a.sectionId);
  if (unsectioned.length > 0) {
    sections.push({
      code: "_misc",
      name: "Прочее",
      attributes: unsectioned,
    });
  }

  return { entity, sections };
}

export async function getDocumentListColumns(entityCode: DocumentEntityCode) {
  const entity = await getMetaEntity(entityCode);
  if (!entity) return [];
  return entity.attributes.filter((a) => a.listVisible && a.formVisible);
}

export async function loadDocumentFormValues(
  entityCode: DocumentEntityCode,
  documentId: string,
) {
  const { entity, sections } = await getDocumentFormAttributes(entityCode);
  if (!entity) return { sections, values: {} as Record<string, unknown> };

  const doc =
    entityCode === "inbound"
      ? await prisma.inboundDocument.findUnique({ where: { id: documentId } })
      : await prisma.outboundDocument.findUnique({ where: { id: documentId } });
  if (!doc) return { sections, values: {} };

  const values: Record<string, unknown> = {};
  const row = doc as Record<string, unknown>;

  for (const attr of entity.attributes) {
    if (!attr.formVisible) continue;
    const field = formFieldName(attr);
    if (attr.widget === "counterparty_supplier" || attr.widget === "counterparty_customer") {
      const name = String(row[attr.systemField!] ?? "");
      if (name) {
        const cp = await prisma.counterparty.findFirst({ where: { name } });
        values[field] = cp?.id ?? "";
      } else {
        values[field] = "";
      }
      continue;
    }
    const raw = row[attr.systemField!];
    if (raw instanceof Date) {
      values[field] = dateFieldValue(raw);
    } else {
      values[field] = raw ?? "";
    }
  }

  const extraAttrs = entity.attributes.filter(isExtraAttr);
  if (extraAttrs.length > 0) {
    const record = await prisma.metaRecord.findUnique({
      where: { entityId_code: { entityId: entity.id, code: documentId } },
      include: { values: { include: { attribute: true } } },
    });
    if (record) {
      for (const v of record.values) {
        values[v.attribute.code] =
          v.valueText ??
          v.valueNumber ??
          v.valueBool ??
          (v.valueDate ? dateFieldValue(v.valueDate) : null);
      }
    }
  }

  return { sections, values };
}

function valueFromForm(type: string, raw: FormDataEntryValue | null) {
  const s = String(raw ?? "").trim();
  if (type === "bool") return raw === "on" || raw === "true" || raw === "1";
  if (type === "number") return s ? Number(s) : null;
  if (!s) return null;
  return s;
}

export async function saveDocumentExtraFromForm(
  entityCode: DocumentEntityCode,
  documentId: string,
  formData: FormData,
  title?: string,
) {
  const entity = await getMetaEntity(entityCode);
  if (!entity) return;
  const extraAttrs = entity.attributes.filter(isExtraAttr);
  if (extraAttrs.length === 0) return;

  await validateDocumentForm(extraAttrs, formData);

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

  for (const attr of extraAttrs) {
    const raw = valueFromForm(attr.type, formData.get(attr.code));
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

export async function loadDocumentExtraRefOptions(entityCode: DocumentEntityCode) {
  const entity = await getMetaEntity(entityCode);
  if (!entity) return {};
  const extraAttrs = entity.attributes.filter(isExtraAttr);
  const refOptions: Record<string, { id: string; label: string }[]> = {};
  for (const attr of extraAttrs) {
    if (attr.type === "ref" && attr.refEntityCode) {
      refOptions[attr.code] = await listRefOptions(attr.refEntityCode);
    }
  }
  return refOptions;
}

export async function loadBatchDocumentExtraValues(
  entityCode: DocumentEntityCode,
  documentIds: string[],
) {
  const entity = await getMetaEntity(entityCode);
  if (!entity || documentIds.length === 0) {
    return {} as Record<string, Record<string, unknown>>;
  }

  const extraAttrs = entity.attributes.filter(isExtraAttr);
  if (extraAttrs.length === 0) return {};

  const records = await prisma.metaRecord.findMany({
    where: { entityId: entity.id, code: { in: documentIds } },
    include: { values: { include: { attribute: true } } },
  });

  const result: Record<string, Record<string, unknown>> = {};
  for (const record of records) {
    if (!record.code) continue;
    const values: Record<string, unknown> = {};
    for (const v of record.values) {
      values[v.attribute.code] =
        v.valueText ??
        v.valueNumber ??
        v.valueBool ??
        (v.valueDate ? dateFieldValue(v.valueDate) : null);
    }
    result[record.code] = values;
  }
  return result;
}
