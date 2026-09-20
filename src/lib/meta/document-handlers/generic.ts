import { getMetaEntity } from "@/lib/meta/catalog";
import { throwLocalized } from "@/lib/i18n/errors-server";
import { requireCustomDocument, requireCustomDocumentWrite } from "@/lib/permissions/check";
import type { DocumentHandler } from "@/lib/meta/document-handlers/types";
import type { DocumentCapability } from "@/lib/meta/types";

export function createGenericDocumentHandler(
  entityCode: string,
  capabilities: DocumentCapability[] = [],
): DocumentHandler {
  return {
    entityCode,
    handler: "generic",
    capabilities,
    async list() {
      const { listCatalogRows } = await import("@/lib/meta/catalog");
      const { rows } = await listCatalogRows(entityCode);
      return rows;
    },
    async get(id) {
      const { getCatalogRow } = await import("@/lib/meta/catalog");
      const { row } = await getCatalogRow(entityCode, id);
      return row;
    },
    async create(formData) {
      const entity = await getMetaEntity(entityCode);
      if (!entity) return throwLocalized("errors.actions.entityNotFound");
      await requireCustomDocumentWrite(
        entity.code,
        entity.storage,
        entity.navItemCode,
      );
      const { saveCatalogFromForm } = await import("@/lib/meta/catalog");
      const result = await saveCatalogFromForm(entityCode, formData);
      return result.id;
    },
    async update(id, formData) {
      const entity = await getMetaEntity(entityCode);
      if (!entity) return throwLocalized("errors.actions.entityNotFound");
      await requireCustomDocumentWrite(
        entity.code,
        entity.storage,
        entity.navItemCode,
      );
      const { saveCatalogFromForm } = await import("@/lib/meta/catalog");
      await saveCatalogFromForm(entityCode, formData, id);
    },
  };
}

export async function requireGenericDocument(entityCode: string) {
  const entity = await getMetaEntity(entityCode);
  if (!entity || entity.storage !== "custom" || entity.kind !== "document") {
    return throwLocalized("errors.documents.notFound");
  }
  await requireCustomDocument(entity.code, entity.storage, entity.navItemCode);
  return entity;
}
