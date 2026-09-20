import { NavMenuTabs } from "@/components/nav-menu-tabs";
import { NsiTabs } from "@/components/nsi-tabs";
import { entityCodeFromNavItemCode } from "@/lib/nav/helpers";
import { getModuleFlags } from "@/lib/session";

export async function CatalogSectionTabs({
  navItemCode,
}: {
  navItemCode: string | null;
}) {
  if (navItemCode) {
    return (
      <NavMenuTabs navSlug={entityCodeFromNavItemCode(navItemCode)} />
    );
  }

  const flags = await getModuleFlags();
  return <NsiTabs flags={flags} />;
}
