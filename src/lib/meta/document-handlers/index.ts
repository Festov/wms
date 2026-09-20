import { getMetaEntity } from "@/lib/meta/catalog";
import { throwLocalized } from "@/lib/i18n/errors-server";
import { createGenericDocumentHandler } from "@/lib/meta/document-handlers/generic";
import { inboundDocumentHandler } from "@/lib/meta/document-handlers/inbound";
import { operationDocumentHandler } from "@/lib/meta/document-handlers/operation";
import { outboundDocumentHandler } from "@/lib/meta/document-handlers/outbound";
import {
  documentCapabilities,
  resolveDocumentHandler,
} from "@/lib/meta/document-registry";
import type {
  DocumentHandler,
  DocumentListFilters,
} from "@/lib/meta/document-handlers/types";

const SYSTEM_HANDLERS: Record<string, DocumentHandler> = {
  inbound: inboundDocumentHandler,
  outbound: outboundDocumentHandler,
  operation: operationDocumentHandler,
};

export async function getDocumentHandler(
  entityCode: string,
): Promise<DocumentHandler | null> {
  if (entityCode in SYSTEM_HANDLERS) {
    return SYSTEM_HANDLERS[entityCode];
  }
  const entity = await getMetaEntity(entityCode);
  if (!entity) return null;
  if (entity.kind !== "document" || entity.storage !== "custom") return null;
  if (resolveDocumentHandler(entity) !== "generic") return null;
  return createGenericDocumentHandler(
    entityCode,
    documentCapabilities(entity),
  );
}

export async function listDocuments(
  entityCode: string,
  filters: DocumentListFilters = {},
) {
  const handler = await getDocumentHandler(entityCode);
  if (!handler) return throwLocalized("errors.documents.notFound");
  return handler.list(filters);
}

export async function getDocument(entityCode: string, id: string) {
  const handler = await getDocumentHandler(entityCode);
  if (!handler) return throwLocalized("errors.documents.notFound");
  return handler.get(id);
}

export async function createDocument(entityCode: string, formData: FormData) {
  return saveDocumentFromForm(entityCode, formData);
}

export async function saveDocumentFromForm(
  entityCode: string,
  formData: FormData,
  id?: string,
) {
  const handler = await getDocumentHandler(entityCode);
  if (!handler) return throwLocalized("errors.documents.notFound");
  if (id) {
    await handler.update(id, formData);
    return id;
  }
  if (!handler.create) return throwLocalized("errors.documents.createNotSupported");
  return handler.create(formData);
}

export { SYSTEM_HANDLERS };
