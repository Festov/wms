import type { MetaEntityFull } from "@/lib/meta/catalog";
import { inboundKindLabel } from "@/lib/inbound-document";
import { outboundKindLabel } from "@/lib/outbound-document";
import { enumLabel } from "@/lib/format";
import { formatTransportUnitLabel } from "@/lib/transport-unit";
import { formatReceivingDockListLabel } from "@/lib/receiving-dock-labels";

export type DocumentEntityCode = "inbound" | "outbound";

export type DocumentFormAttr = MetaEntityFull["attributes"][number];

export type DocumentFieldContext = {
  counterparties?: { id: string; label: string }[];
  docks?: { id: string; label: string; disabled?: boolean }[];
  transportUnits?: { id: string; label: string }[];
  extraRefOptions?: Record<string, { id: string; label: string }[]>;
};

export function dateFieldValue(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

/** Секции для формы создания (без номера документа). */
export function filterCreateSections(
  sections: { code: string; name: string; attributes: DocumentFormAttr[] }[],
) {
  return sections
    .map((section) => ({
      ...section,
      attributes: section.attributes.filter((a) => a.widget !== "readonly"),
    }))
    .filter((section) => section.attributes.length > 0);
}

/** Объединить header + main для карточки документа. */
export function mergeDetailSections(
  sections: { code: string; name: string; attributes: DocumentFormAttr[] }[],
) {
  const header = sections.find((s) => s.code === "header")?.attributes ?? [];
  const main = sections.find((s) => s.code === "main")?.attributes ?? [];
  return [{ code: "detail", name: "Реквизиты", attributes: [...header, ...main] }];
}

export function extraSectionAttributes(
  sections: { code: string; name: string; attributes: DocumentFormAttr[] }[],
) {
  return sections.find((s) => s.code === "extra")?.attributes ?? [];
}

export function enumOptionsForAttr(
  entityCode: DocumentEntityCode,
  attr: DocumentFormAttr,
) {
  if (!attr.enumValues) return [];
  try {
    const values = JSON.parse(attr.enumValues) as string[];
    return values.map((value) => ({
      value,
      label:
        attr.systemField === "kind"
          ? entityCode === "inbound"
            ? inboundKindLabel(value)
            : outboundKindLabel(value)
          : enumLabel(value),
    }));
  } catch {
    return [];
  }
}

export function formFieldName(attr: DocumentFormAttr) {
  if (attr.widget === "counterparty_supplier") return "supplierId";
  if (attr.widget === "counterparty_customer") return "customerId";
  if (
    attr.systemField === "supplier" ||
    (attr.code === "supplier" && !attr.widget)
  ) {
    return "supplierId";
  }
  if (
    attr.systemField === "customer" ||
    (attr.code === "customer" && !attr.widget)
  ) {
    return "customerId";
  }
  return attr.code;
}

export function resolveDocumentFieldWidget(attr: DocumentFormAttr) {
  if (attr.widget) return attr.widget;
  if (attr.systemField === "receivingDockId" || attr.code === "receivingDockId") {
    return "receivingDock";
  }
  if (attr.systemField === "transportUnitId" || attr.code === "transportUnitId") {
    return "transportUnit";
  }
  if (attr.systemField === "supplier" || attr.code === "supplier") {
    return "counterparty_supplier";
  }
  if (attr.systemField === "customer" || attr.code === "customer") {
    return "counterparty_customer";
  }
  if (attr.systemField === "number" || attr.code === "number") {
    return "readonly";
  }
  return null;
}

export function formatListCellValue(
  entityCode: DocumentEntityCode,
  attr: DocumentFormAttr,
  doc: Record<string, unknown>,
  extraValues?: Record<string, unknown>,
) {
  if (!attr.systemField) {
    const raw = extraValues?.[attr.code];
    if (raw == null || raw === "") return "—";
    if (raw instanceof Date) return dateFieldValue(raw);
    if (attr.type === "bool") return raw ? "да" : "—";
    return String(raw);
  }
  const raw = doc[attr.systemField];
  if (raw == null || raw === "") return "—";
  if (raw instanceof Date) return dateFieldValue(raw);
  if (attr.systemField === "kind") {
    return entityCode === "inbound"
      ? inboundKindLabel(String(raw))
      : outboundKindLabel(String(raw));
  }
  if (
    attr.systemField === "receivingDockId" ||
    resolveDocumentFieldWidget(attr) === "receivingDock"
  ) {
    const dock = doc.receivingDock as
      | { name: string; zone?: { name: string } | null }
      | null
      | undefined;
    if (dock?.name) return formatReceivingDockListLabel(dock);
    return String(raw);
  }
  if (
    attr.systemField === "transportUnitId" ||
    resolveDocumentFieldWidget(attr) === "transportUnit"
  ) {
    const unit = doc.transportUnit as
      | Parameters<typeof formatTransportUnitLabel>[0]
      | null
      | undefined;
    if (unit) return formatTransportUnitLabel(unit);
    return String(raw);
  }
  return String(raw);
}
