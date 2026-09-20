import { prisma } from "@/lib/db";
import {
  type NavItemRecord,
  parseActivePrefixes,
} from "@/lib/nav/helpers";

export type { NavItemRecord } from "@/lib/nav/helpers";
export {
  catalogNavHref,
  defaultNavItemCodeForEntity,
  entityCodeFromNavItemCode,
  navHrefForNavItem,
  navHubHref,
  navItemIconCode,
  serializeActivePrefixes,
} from "@/lib/nav/helpers";

function mapNavItem(row: {
  id: string;
  code: string;
  label: string;
  href: string;
  iconKey: string;
  sortOrder: number;
  isActive: boolean;
  openInNewTab: boolean;
  activePrefixes: string | null;
  metaEntityCode: string | null;
}): NavItemRecord {
  return {
    ...row,
    activePrefixes: parseActivePrefixes(row.activePrefixes),
  };
}

export async function listNavItems(options?: { activeOnly?: boolean }) {
  const rows = await prisma.navItem.findMany({
    where: options?.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map(mapNavItem);
}

export async function listActiveNavItemsForShell() {
  return listNavItems({ activeOnly: true });
}
