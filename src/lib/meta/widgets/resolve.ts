import {
  formFieldName,
  resolveDocumentFieldWidget,
  type DocumentEntityCode,
  type DocumentFormAttr,
} from "@/lib/meta/document-form-shared";

export type MetaFormAttr = DocumentFormAttr;

export function isSystemDocumentEntityCode(
  entityCode?: string,
): entityCode is DocumentEntityCode {
  return entityCode === "inbound" || entityCode === "outbound";
}

export function resolveMetaFieldName(
  attr: MetaFormAttr,
  entityCode?: string,
): string {
  if (isSystemDocumentEntityCode(entityCode)) {
    return formFieldName(attr);
  }
  return attr.code;
}

export function resolveMetaFieldWidget(
  attr: MetaFormAttr,
  entityCode?: string,
): string | null {
  if (isSystemDocumentEntityCode(entityCode)) {
    return resolveDocumentFieldWidget(attr);
  }
  return attr.widget ?? null;
}
