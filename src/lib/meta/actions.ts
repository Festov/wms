"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { throwActionError } from "@/lib/i18n/locale-server";
import { throwLocalized } from "@/lib/i18n/errors-server";
import { requireAdminWrite } from "@/lib/session";
import { ensureRolePermissions, requireEntityPermission, requireNsiCatalogWrite } from "@/lib/permissions/check";
import {
  getMetaEntity,
  saveCatalogFromForm,
  invalidateMetaEntityCache,
} from "@/lib/meta/catalog";
import { prisma } from "@/lib/db";
import { createPalletsBatch } from "@/lib/pallet-code";
import { revalidateCatalogSideEffects } from "@/lib/meta/revalidate-nsi";
import { saveDocumentFromForm } from "@/lib/meta/document-handlers";
import {
  assertValidEntityCode,
  sanitizeEntityCode,
} from "@/lib/entity-code";
import {
  entityCodeFromNavItemCode,
  navHubHref,
} from "@/lib/nav/helpers";
import {
  addCustomDocumentLine,
  deleteCustomDocumentLine,
  ensureDefaultLineDefinition,
  updateCustomDocumentLine,
} from "@/lib/meta/custom-lines";
import { hasCapability } from "@/lib/meta/document-registry";
import { serializeCapabilities, type DocumentCapability } from "@/lib/meta/types";

function revalidateCustomMetaEntity(
  code: string,
  kind: string,
  navItemCodes: Array<string | null | undefined>,
) {
  revalidatePath("/admin/meta");
  revalidatePath(`/admin/meta/${code}`);
  revalidatePath("/admin/nav");
  revalidatePath("/admin/roles");
  revalidatePath("/nsi");
  revalidatePath("/", "layout");
  if (kind === "document") {
    revalidatePath(`/doc/${code}`);
  } else {
    revalidatePath(`/catalog/${code}`);
  }
  for (const navItemCode of navItemCodes) {
    if (!navItemCode) continue;
    revalidatePath(navHubHref(entityCodeFromNavItemCode(navItemCode)));
  }
}

async function requireEntityCatalogWrite(entityCode: string) {
  await requireEntityPermission(entityCode, "write");
}

export async function createCatalogRecord(entityCode: string, formData: FormData) {
  await requireEntityCatalogWrite(entityCode);

  if (entityCode === "pallets") {
    const typeId = String(formData.get("palletTypeId") ?? "").trim();
    if (!typeId) return throwLocalized("errors.meta.palletTypeRequired");
    const qtyRaw = Number(formData.get("quantity") ?? 1);
    const quantity = Number.isFinite(qtyRaw)
      ? Math.min(500, Math.max(1, Math.floor(qtyRaw)))
      : 1;

    const created = await createPalletsBatch(typeId, quantity);
    revalidatePath(`/catalog/${entityCode}`);
    revalidateCatalogSideEffects(entityCode);
    const returnTo = String(formData.get("returnTo") ?? "").trim();
    if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      redirect(returnTo);
    }
    if (created.length === 1) {
      redirect(`/catalog/${entityCode}/${created[0].id}`);
    }
    redirect(`/catalog/${entityCode}`);
  }

  const row = await saveCatalogFromForm(entityCode, formData);
  revalidatePath(`/catalog/${entityCode}`);
  revalidateCatalogSideEffects(entityCode);
  if (entityCode === "packages") {
    const productId = String(formData.get("productId") ?? "").trim();
    if (productId) revalidatePath(`/catalog/nomenclature/${productId}`);
  }
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    redirect(returnTo);
  }
  redirect(`/catalog/${entityCode}/${row.id}`);
}

/** Создать упаковку для номенклатуры (из карточки товара). */
export async function createProductPackage(
  productId: string,
  formData: FormData,
) {
  await requireNsiCatalogWrite("packages");
  formData.set("productId", productId);
  await saveCatalogFromForm("packages", formData);
  revalidatePath("/catalog/packages");
  revalidateCatalogSideEffects("packages");
  revalidatePath(`/catalog/nomenclature/${productId}`);
  redirect(`/catalog/nomenclature/${productId}`);
}

/** Обновить упаковку из модалки на карточке номенклатуры (без ухода со страницы). */
export async function updateProductPackage(
  productId: string,
  packageId: string,
  formData: FormData,
) {
  await requireNsiCatalogWrite("packages");
  const pkg = await prisma.package.findFirst({
    where: { id: packageId, productId },
  });
  if (!pkg) return throwLocalized("errors.meta.packageNotFound");

  formData.set("productId", productId);
  await saveCatalogFromForm("packages", formData, packageId);
  revalidatePath("/catalog/packages");
  revalidateCatalogSideEffects("packages");
  revalidatePath(`/catalog/packages/${packageId}`);
  revalidatePath(`/catalog/nomenclature/${productId}`);
}

export async function updateCatalogRecord(
  entityCode: string,
  id: string,
  formData: FormData,
) {
  await requireEntityCatalogWrite(entityCode);
  await saveCatalogFromForm(entityCode, formData, id);
  revalidatePath(`/catalog/${entityCode}`);
  revalidatePath(`/catalog/${entityCode}/${id}`);
  revalidateCatalogSideEffects(entityCode);
  redirect(`/catalog/${entityCode}/${id}`);
}

async function requireEntityDocumentWrite(entityCode: string) {
  const entity = await getMetaEntity(entityCode);
  if (!entity) return throwLocalized("errors.documents.notFound");
  if (entity.kind !== "document" || entity.storage !== "custom") {
    return throwLocalized("errors.meta.notCustomDocument");
  }
  await requireEntityPermission(entityCode, "write");
}

export async function createDocumentRecord(entityCode: string, formData: FormData) {
  await requireEntityDocumentWrite(entityCode);
  const id = await saveDocumentFromForm(entityCode, formData);
  revalidatePath(`/doc/${entityCode}`);
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    redirect(returnTo);
  }
  redirect(`/doc/${entityCode}/${id}`);
}

export async function updateDocumentRecord(
  entityCode: string,
  id: string,
  formData: FormData,
) {
  await requireEntityDocumentWrite(entityCode);
  await saveDocumentFromForm(entityCode, formData, id);
  revalidatePath(`/doc/${entityCode}`);
  revalidatePath(`/doc/${entityCode}/${id}`);
  redirect(`/doc/${entityCode}/${id}`);
}

export async function addCustomDocumentLineAction(
  entityCode: string,
  recordId: string,
  formData: FormData,
) {
  await requireEntityDocumentWrite(entityCode);
  await addCustomDocumentLine(entityCode, recordId, formData);
  revalidatePath(`/doc/${entityCode}`);
  revalidatePath(`/doc/${entityCode}/${recordId}`);
  revalidatePath(`/doc/${entityCode}/${recordId}/new`);
  redirect(`/doc/${entityCode}/${recordId}`);
}

export async function updateCustomDocumentLineAction(
  entityCode: string,
  recordId: string,
  lineId: string,
  formData: FormData,
) {
  await requireEntityDocumentWrite(entityCode);
  await updateCustomDocumentLine(entityCode, recordId, lineId, formData);
  revalidatePath(`/doc/${entityCode}`);
  revalidatePath(`/doc/${entityCode}/${recordId}`);
  revalidatePath(`/doc/${entityCode}/${recordId}/lines/${lineId}`);
  redirect(`/doc/${entityCode}/${recordId}`);
}

export async function deleteCustomDocumentLineAction(
  entityCode: string,
  recordId: string,
  lineId: string,
) {
  await requireEntityDocumentWrite(entityCode);
  await deleteCustomDocumentLine(entityCode, recordId, lineId);
  revalidatePath(`/doc/${entityCode}`);
  revalidatePath(`/doc/${entityCode}/${recordId}`);
  redirect(`/doc/${entityCode}/${recordId}`);
}

export async function createCustomEntity(formData: FormData) {
  await requireAdminWrite();
  const code = sanitizeEntityCode(String(formData.get("code") ?? ""));
  assertValidEntityCode(code);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return throwLocalized("errors.actions.nameRequired");
  const pluralName = String(formData.get("pluralName") ?? name).trim() || name;
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const navItemCode = String(formData.get("navItemCode") ?? "").trim() || null;

  if (navItemCode) {
    const navItem = await prisma.navItem.findUnique({
      where: { code: navItemCode },
    });
    if (!navItem) return throwLocalized("errors.meta.navItemNotFound");
  }

  const entity = await prisma.metaEntity.create({
    data: {
      code,
      name,
      pluralName,
      description,
      kind: "catalog",
      storage: "custom",
      navItemCode,
      sections: {
        create: [{ code: "main", name: "Основные", order: 0 }],
      },
      attributes: {
        create: [
          {
            code: "code",
            name: "Код",
            type: "string",
            required: true,
            order: 0,
            listVisible: true,
          },
          {
            code: "name",
            name: "Название",
            type: "string",
            required: true,
            order: 1,
            listVisible: true,
          },
        ],
      },
    },
    include: { sections: true },
  });

  const main = entity.sections[0];
  if (main) {
    await prisma.metaAttribute.updateMany({
      where: { entityId: entity.id },
      data: { sectionId: main.id },
    });
  }

  revalidateCustomMetaEntity(entity.code, entity.kind, [navItemCode]);
  invalidateMetaEntityCache();
  await ensureRolePermissions();
  return { code: entity.code };
}

export async function createCustomDocument(formData: FormData) {
  await requireAdminWrite();
  const code = sanitizeEntityCode(String(formData.get("code") ?? ""));
  assertValidEntityCode(code);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return throwLocalized("errors.actions.nameRequired");
  const pluralName = String(formData.get("pluralName") ?? name).trim() || name;
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const navItemCode = String(formData.get("navItemCode") ?? "").trim() || null;
  const withLines = formData.get("withLines") === "on";

  if (navItemCode) {
    const navItem = await prisma.navItem.findUnique({
      where: { code: navItemCode },
    });
    if (!navItem) return throwLocalized("errors.meta.navItemNotFound");
  }

  const entity = await prisma.metaEntity.create({
    data: {
      code,
      name,
      pluralName,
      description,
      kind: "document",
      storage: "custom",
      navItemCode,
      capabilities: withLines ? serializeCapabilities(["lines"]) : null,
      sections: {
        create: [
          { code: "header", name: "Шапка", order: 0 },
          { code: "main", name: "Основные", order: 1 },
        ],
      },
      attributes: {
        create: [
          {
            code: "number",
            name: "Номер",
            type: "string",
            required: true,
            order: 0,
            listVisible: true,
            formVisible: true,
          },
          {
            code: "date",
            name: "Дата",
            type: "date",
            required: true,
            order: 1,
            listVisible: true,
            formVisible: true,
          },
          {
            code: "comment",
            name: "Комментарий",
            type: "string",
            required: false,
            order: 2,
            listVisible: false,
            formVisible: true,
          },
        ],
      },
    },
    include: { sections: true },
  });

  const header = entity.sections.find((s) => s.code === "header");
  const main = entity.sections.find((s) => s.code === "main");
  if (header) {
    await prisma.metaAttribute.updateMany({
      where: { entityId: entity.id, code: { in: ["number", "date"] } },
      data: { sectionId: header.id },
    });
  }
  if (main) {
    await prisma.metaAttribute.updateMany({
      where: { entityId: entity.id, code: "comment" },
      data: { sectionId: main.id },
    });
  }

  if (withLines) {
    await ensureDefaultLineDefinition(entity.id);
  }

  revalidateCustomMetaEntity(entity.code, entity.kind, [navItemCode]);
  invalidateMetaEntityCache();
  await ensureRolePermissions();
  return { code: entity.code };
}

export async function updateCustomMetaEntity(formData: FormData) {
  await requireAdminWrite();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return throwLocalized("errors.meta.entityCodeRequired");

  const entity = await prisma.metaEntity.findUnique({ where: { code } });
  if (!entity || entity.storage !== "custom") {
    return throwLocalized("errors.meta.customOnlyEditable");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return throwLocalized("errors.actions.nameRequired");
  const pluralName = String(formData.get("pluralName") ?? name).trim() || name;
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const navItemCode = String(formData.get("navItemCode") ?? "").trim() || null;

  if (navItemCode) {
    const navItem = await prisma.navItem.findUnique({
      where: { code: navItemCode },
    });
    if (!navItem) return throwLocalized("errors.meta.navItemNotFound");
  }

  const prevNavItemCode = entity.navItemCode;

  const updateData: {
    name: string;
    pluralName: string;
    description: string | null;
    navItemCode: string | null;
    capabilities?: string | null;
  } = { name, pluralName, description, navItemCode };

  if (entity.kind === "document") {
    const caps: DocumentCapability[] = [];
    if (formData.get("withLines") === "on") caps.push("lines");
    if (formData.get("withWorkflow") === "on") caps.push("workflow");
    updateData.capabilities =
      caps.length > 0 ? serializeCapabilities(caps) : null;
  }

  await prisma.metaEntity.update({
    where: { code },
    data: updateData,
  });

  if (entity.kind === "document" && formData.get("withLines") === "on") {
    await ensureDefaultLineDefinition(entity.id);
  }

  invalidateMetaEntityCache(code);
  await ensureRolePermissions();
  revalidateCustomMetaEntity(entity.code, entity.kind, [
    prevNavItemCode,
    navItemCode,
  ]);
}

export async function addMetaAttribute(entityCode: string, formData: FormData) {
  await requireAdminWrite();
  const entity = await getMetaEntity(entityCode);
  if (!entity) {
    return throwLocalized("errors.actions.entityNotFound");
  }

  const code = String(formData.get("code") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "string");
  const sectionCode = String(formData.get("section") ?? "main");
  const section = entity.sections.find((s) => s.code === sectionCode);

  if (!code || !name) await throwActionError("codeAndNameRequired");
  if (entity.attributes.some((a) => a.code === code)) {
    return throwLocalized("errors.meta.attributeCodeExists");
  }

  await prisma.metaAttribute.create({
    data: {
      entityId: entity.id,
      code,
      name,
      type,
      required: formData.get("required") === "on",
      refEntityCode: String(formData.get("refEntityCode") ?? "") || null,
      enumValues: String(formData.get("enumValues") ?? "")
        ? JSON.stringify(
            String(formData.get("enumValues"))
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        : null,
      sectionId: section?.id,
      order: entity.attributes.length,
      isSystem: false,
      systemField: null,
      listVisible: formData.get("listVisible") === "on",
      formVisible: formData.get("formVisible") === "on",
    },
  });

  revalidateDocumentMetaPaths(entityCode);
}

export async function addMetaLineColumn(entityCode: string, formData: FormData) {
  await requireAdminWrite();
  const entity = await getMetaEntity(entityCode);
  if (!entity) {
    return throwLocalized("errors.actions.entityNotFound");
  }
  if (entity.kind !== "document" || entity.storage !== "custom") {
    return throwLocalized("errors.meta.lineColumnsCustomOnly");
  }

  const lineDef = await ensureDefaultLineDefinition(entity.id);
  if (!hasCapability(entity, "lines")) {
    await prisma.metaEntity.update({
      where: { id: entity.id },
      data: { capabilities: serializeCapabilities(["lines"]) },
    });
  }

  const code = String(formData.get("code") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "string");
  const refEntityCode = String(formData.get("refEntityCode") ?? "") || null;

  if (!code || !name) await throwActionError("codeAndNameRequired");
  if (type === "ref" && !refEntityCode) {
    return throwLocalized("errors.meta.refCatalogRequired");
  }

  const existing = await prisma.metaLineColumn.findFirst({
    where: { lineDefId: lineDef.id, code },
  });
  if (existing) return throwLocalized("errors.meta.columnCodeExists");

  await prisma.metaLineColumn.create({
    data: {
      lineDefId: lineDef.id,
      code,
      name,
      type,
      refEntityCode: type === "ref" ? refEntityCode : null,
      required: formData.get("required") === "on",
      listVisible: true,
      sortOrder: (
        await prisma.metaLineColumn.count({ where: { lineDefId: lineDef.id } })
      ),
    },
  });

  revalidateDocumentMetaPaths(entityCode);
  revalidatePath(`/doc/${entityCode}`);
}

export async function updateMetaAttribute(
  entityCode: string,
  attributeId: string,
  formData: FormData,
) {
  await requireAdminWrite();
  const entity = await getMetaEntity(entityCode);
  if (!entity) {
    return throwLocalized("errors.actions.entityNotFound");
  }
  const attr = entity.attributes.find((a) => a.id === attributeId);
  if (!attr) return throwLocalized("errors.meta.attributeNotFound");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return throwLocalized("errors.actions.nameRequired");

  const sectionCode = String(formData.get("section") ?? "");
  const section = entity.sections.find((s) => s.code === sectionCode);

  await prisma.metaAttribute.update({
    where: { id: attributeId },
    data: {
      name,
      required: formData.get("required") === "on",
      listVisible: formData.get("listVisible") === "on",
      formVisible: formData.get("formVisible") === "on",
      sectionId: section?.id ?? attr.sectionId,
    },
  });

  revalidateDocumentMetaPaths(entityCode);
}

export async function deleteMetaAttribute(
  entityCode: string,
  attributeId: string,
) {
  await requireAdminWrite();
  const attr = await prisma.metaAttribute.findUnique({
    where: { id: attributeId },
  });
  if (!attr) return throwLocalized("errors.meta.attributeNotFound");
  if (attr.isSystem) return throwLocalized("errors.meta.systemAttributeCannotDelete");

  await prisma.metaValue.deleteMany({ where: { attributeId } });
  await prisma.metaAttribute.delete({ where: { id: attributeId } });
  revalidateDocumentMetaPaths(entityCode);
}

export async function moveMetaAttribute(
  entityCode: string,
  attributeId: string,
  direction: "up" | "down",
) {
  await requireAdminWrite();
  const entity = await getMetaEntity(entityCode);
  if (!entity) {
    return throwLocalized("errors.actions.entityNotFound");
  }
  const sorted = [...entity.attributes].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((a) => a.id === attributeId);
  if (index < 0) return throwLocalized("errors.meta.attributeNotFound");
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= sorted.length) return;

  const current = sorted[index];
  const other = sorted[swapIndex];
  await prisma.$transaction([
    prisma.metaAttribute.update({
      where: { id: current.id },
      data: { order: other.order },
    }),
    prisma.metaAttribute.update({
      where: { id: other.id },
      data: { order: current.order },
    }),
  ]);
  revalidateDocumentMetaPaths(entityCode);
}

function revalidateDocumentMetaPaths(entityCode: string) {
  revalidatePath(`/admin/meta/${entityCode}`);
  revalidatePath(`/catalog/${entityCode}`);
  invalidateMetaEntityCache(entityCode);
  if (entityCode === "inbound") {
    revalidatePath("/doc/inbound");
    revalidatePath("/doc/inbound/new");
    revalidatePath("/inbound");
    revalidatePath("/inbound/new");
  }
  if (entityCode === "outbound") {
    revalidatePath("/doc/outbound");
    revalidatePath("/doc/outbound/new");
    revalidatePath("/outbound");
    revalidatePath("/outbound/new");
  }
  if (entityCode === "operation") {
    revalidatePath("/doc/operation");
    revalidatePath("/operations");
  }
  revalidatePath("/admin/meta");
}

export async function saveNavIcon(formData: FormData) {
  await requireAdminWrite();
  const code = String(formData.get("code") ?? "").trim();
  const iconKey = String(formData.get("iconKey") ?? "").trim();
  if (!code || !iconKey) return;
  await prisma.navIconOverride.upsert({
    where: { code },
    create: { code, iconKey },
    update: { iconKey },
  });
  revalidatePath("/");
  revalidatePath("/admin/nav");
}
