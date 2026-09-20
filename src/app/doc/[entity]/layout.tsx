import { notFound } from "next/navigation";
import { getMetaEntity } from "@/lib/meta/catalog";
import {
  documentModuleForEntity,
  isSystemDocumentEntity,
} from "@/lib/meta/document-registry";
import { requireCustomDocument } from "@/lib/permissions/check";
import { requireModule } from "@/lib/session";
import { CatalogSectionTabs } from "@/components/catalog-section-tabs";

export default async function DocumentEntityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ entity: string }>;
}) {
  const { entity: entityCode } = await params;
  const entity = await getMetaEntity(entityCode);

  if (!entity) notFound();
  if (entity.kind !== "document" && entity.kind !== "journal") notFound();

  if (entity.storage === "custom") {
    await requireCustomDocument(entity.code, entity.storage, entity.navItemCode);
    if (entity.navItemCode) await requireModule("menus");
  } else if (isSystemDocumentEntity(entityCode)) {
    const mod = documentModuleForEntity(entityCode);
    if (mod) await requireModule(mod);
  } else {
    notFound();
  }

  return (
    <>
      {entity.navItemCode ? (
        <CatalogSectionTabs navItemCode={entity.navItemCode} />
      ) : null}
      {children}
    </>
  );
}
