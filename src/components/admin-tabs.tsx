import { getTranslations } from "next-intl/server";
import { SectionTabs } from "@/components/section-tabs";
import { ADMIN_TABS, translateAdminTab } from "@/lib/admin/nav";

export async function AdminTabs() {
  const t = await getTranslations("admin");
  return (
    <SectionTabs
      tabs={ADMIN_TABS.map((tab) => ({
        href: tab.href,
        label: translateAdminTab(tab, t),
      }))}
      variant="admin"
    />
  );
}
