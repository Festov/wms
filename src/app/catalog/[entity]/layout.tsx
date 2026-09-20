import { notFound } from "next/navigation";
import { CatalogSectionTabs } from "@/components/catalog-section-tabs";
import { getMetaEntity } from "@/lib/meta/catalog";
import { requireNsiCatalog } from "@/lib/permissions/check";
import { requireModule } from "@/lib/session";

export default async function EntityCatalogLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ entity: string }>;
}) {
  const { entity: entityCode } = await params;
  const entity = await getMetaEntity(entityCode);
  if (!entity) notFound();

  await requireNsiCatalog(entity.code, entity.storage, entity.navItemCode);
  if (entity.navItemCode) {
    await requireModule("menus");
  }

  return (
    <>
      <CatalogSectionTabs navItemCode={entity.navItemCode} />
      {children}
    </>
  );
}
