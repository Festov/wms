"use server";

import { throwLocalized } from "@/lib/i18n/errors-server";
import { getDocumentFormAttributes } from "@/lib/meta/document-form";
import { validateDocumentForm } from "@/lib/meta/document-form-validate";
import { inboundDocumentHandler } from "@/lib/meta/document-handlers/inbound";
import { outboundDocumentHandler } from "@/lib/meta/document-handlers/outbound";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/** @deprecated Use saveDocumentFromForm("inbound", formData, id) */
export async function saveInboundDocumentMeta(formData: FormData) {
  const documentId = str(formData, "documentId");
  if (!documentId) return throwLocalized("errors.documents.notSpecified");
  await inboundDocumentHandler.update(documentId, formData);
}

/** @deprecated Use saveDocumentFromForm("outbound", formData, id) */
export async function saveOutboundDocumentMeta(formData: FormData) {
  const documentId = str(formData, "documentId");
  if (!documentId) return throwLocalized("errors.documents.notSpecified");
  await outboundDocumentHandler.update(documentId, formData);
}

export async function validateInboundCreateMeta(formData: FormData) {
  const { entity } = await getDocumentFormAttributes("inbound");
  if (!entity) return;
  const attrs = entity.attributes.filter(
    (a) => a.formVisible && a.systemField && a.isSystem && a.widget !== "readonly",
  );
  await validateDocumentForm(attrs, formData);
  const extra = entity.attributes.filter((a) => !a.systemField && !a.isSystem);
  await validateDocumentForm(extra, formData);
}

export async function validateOutboundCreateMeta(formData: FormData) {
  const { entity } = await getDocumentFormAttributes("outbound");
  if (!entity) return;
  const attrs = entity.attributes.filter(
    (a) => a.formVisible && a.systemField && a.isSystem && a.widget !== "readonly",
  );
  await validateDocumentForm(attrs, formData);
  const extra = entity.attributes.filter((a) => !a.systemField && !a.isSystem);
  await validateDocumentForm(extra, formData);
}
