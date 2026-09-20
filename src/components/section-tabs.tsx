"use client";

import { adminTabActive } from "@/lib/admin/nav";
import { cn } from "@/lib/format";
import { navMenuTabActive } from "@/lib/nav/menu-nav";
import { nsiTabActive } from "@/lib/nsi/tab-active";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export type SectionTab = {
  href: string;
  label: string;
};

type SectionTabsVariant = "nsi" | "admin" | "navMenu";

const tabActive: Record<
  SectionTabsVariant,
  (pathname: string, href: string) => boolean
> = {
  nsi: nsiTabActive,
  admin: adminTabActive,
  navMenu: navMenuTabActive,
};

export function SectionTabs({
  tabs,
  variant,
}: {
  tabs: SectionTab[];
  variant: SectionTabsVariant;
}) {
  const pathname = usePathname();
  const isActive = tabActive[variant];
  const t = useTranslations("components.sectionTabs");

  return (
    <nav
      className="-mx-1 mb-6 overflow-x-auto border-b border-[var(--line)] pb-px"
      aria-label={t("ariaLabel")}
    >
      <div className="flex min-w-max gap-1 px-1">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition",
                active
                  ? "border-[var(--accent)] text-[var(--ink)]"
                  : "border-transparent text-[var(--muted)] hover:border-[var(--line)] hover:text-[var(--ink)]",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
