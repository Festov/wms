import { SectionTabs } from "@/components/section-tabs";
import { prisma } from "@/lib/db";
import {
  menuCatalogViewPermission,
  menuDocumentViewPermission,
} from "@/lib/menu/permissions";
import { getUserPermissionSet } from "@/lib/permissions/check";
import {
  catalogNavHref,
  documentNavHref,
  navHubHref,
  navItemIconCode,
} from "@/lib/nav/helpers";
import { requireUser } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export async function NavMenuTabs({ navSlug }: { navSlug: string }) {
  const user = await requireUser();
  const permissions = await getUserPermissionSet(user.id);
  const t = await getTranslations("nsi");
  const navCode = navItemIconCode(navSlug);
  const [navItem, entities] = await Promise.all([
    prisma.navItem.findUnique({ where: { code: navCode } }),
    prisma.metaEntity.findMany({
      where: { navItemCode: navCode, storage: "custom", isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!navItem) return null;

  const catalogTabs = entities
    .filter(
      (entity) =>
        entity.kind === "catalog" &&
        permissions.has(menuCatalogViewPermission(entity.code)),
    )
    .map((entity) => ({
      href: catalogNavHref(entity.code),
      label: entity.pluralName ?? entity.name,
    }));

  const documentTabs = entities
    .filter(
      (entity) =>
        entity.kind === "document" &&
        permissions.has(menuDocumentViewPermission(entity.code)),
    )
    .map((entity) => ({
      href: documentNavHref(entity.code),
      label: entity.pluralName ?? entity.name,
    }));

  const tabs = [
    { href: navHubHref(navSlug), label: t("tabs.overview") },
    ...catalogTabs,
    ...documentTabs,
  ];

  return <SectionTabs tabs={tabs} variant="navMenu" />;
}
