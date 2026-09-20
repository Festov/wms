import { SectionTabs } from "@/components/section-tabs";
import { listMetaEntities } from "@/lib/meta/catalog";
import { filterNsiTabs, translateNsiTab } from "@/lib/nsi/nav";
import { nsiCatalogViewPermission, nsiDocumentViewPermission } from "@/lib/menu/permissions";
import { catalogNavHref, documentNavHref } from "@/lib/nav/helpers";
import type { ModuleFlags } from "@/lib/modules/registry";
import { getUserAllowedModules, getUserPermissionSet } from "@/lib/permissions/check";
import { requireUser } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export async function NsiTabs({
  flags,
}: {
  flags: Pick<ModuleFlags, "topology" | "lots">;
}) {
  const user = await requireUser();
  const t = await getTranslations("nsi");
  const [permissions, allowedModules] = await Promise.all([
    getUserPermissionSet(user.id),
    getUserAllowedModules(user.id),
  ]);

  const [tabs, custom] = await Promise.all([
    Promise.resolve(
      filterNsiTabs({
        topology: flags.topology,
        lots: flags.lots,
        allowedTopology: allowedModules.has("topology"),
        allowedLots: allowedModules.has("lots"),
        permissions,
      }),
    ),
    listMetaEntities(),
  ]);

  const customCatalogTabs = custom
    .filter((e) => e.storage === "custom" && !e.navItemCode && e.kind === "catalog")
    .filter((e) => permissions.has(nsiCatalogViewPermission(e.code)))
    .map((e) => ({
      href: catalogNavHref(e.code),
      label: e.pluralName ?? e.name,
    }));

  const customDocumentTabs = custom
    .filter((e) => e.storage === "custom" && !e.navItemCode && e.kind === "document")
    .filter((e) => permissions.has(nsiDocumentViewPermission(e.code)))
    .map((e) => ({
      href: documentNavHref(e.code),
      label: e.pluralName ?? e.name,
    }));

  return (
    <SectionTabs
      tabs={[
        ...tabs.map((tab) => ({
          href: tab.href,
          label: translateNsiTab(tab, t),
        })),
        ...customCatalogTabs,
        ...customDocumentTabs,
      ]}
      variant="nsi"
    />
  );
}
