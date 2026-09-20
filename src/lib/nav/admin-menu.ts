import { prisma } from "@/lib/db";
import { listNavItems } from "@/lib/nav/catalog";
import type { NavItemRecord } from "@/lib/nav/helpers";
import { navHrefForNavItem } from "@/lib/nav/helpers";
import {
  buildDefaultSidebarOrder,
  isSystemSidebarKey,
  mergeSidebarNavOrder,
  parseSidebarNavOrder,
  resolveSidebarNavOrder,
  serializeSidebarNavOrder,
  sortedNavItemKeys,
  SYSTEM_SIDEBAR_ENTRIES,
  SYSTEM_SIDEBAR_KEYS,
} from "@/lib/nav/sidebar-menu";

export type AdminMenuRow = {
  key: string;
  kind: "system" | "custom";
  label: string;
  href: string;
  defaultIcon: string;
  iconKey: string;
  navItemId?: string;
  isActive: boolean;
  openInNewTab: boolean;
  metaEntityCode: string | null;
};

export async function getStoredSidebarNavOrder() {
  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { sidebarNavOrder: true },
  });
  return parseSidebarNavOrder(settings?.sidebarNavOrder);
}

export async function saveSidebarNavOrder(keys: string[]) {
  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, sidebarNavOrder: serializeSidebarNavOrder(keys) },
    update: { sidebarNavOrder: serializeSidebarNavOrder(keys) },
  });
}

export async function insertSidebarNavKey(
  key: string,
  afterKey?: string | null,
) {
  const [stored, navItems] = await Promise.all([
    getStoredSidebarNavOrder(),
    prisma.navItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { code: true, sortOrder: true, label: true },
    }),
  ]);
  const navKeys = sortedNavItemKeys(navItems);
  const available = [...SYSTEM_SIDEBAR_KEYS, ...navKeys];
  const order = mergeSidebarNavOrder(
    stored,
    available,
    buildDefaultSidebarOrder(navKeys),
  );
  if (order.includes(key)) return;

  if (afterKey) {
    const afterIndex = order.indexOf(afterKey);
    if (afterIndex >= 0) {
      order.splice(afterIndex + 1, 0, key);
    } else {
      order.push(key);
    }
  } else {
    const nsiIndex = order.indexOf("nsi");
    if (key.startsWith("nav:") && nsiIndex >= 0) {
      order.splice(nsiIndex + 1, 0, key);
    } else {
      order.push(key);
    }
  }

  await saveSidebarNavOrder(order);
}

export async function appendSidebarNavKey(key: string) {
  await insertSidebarNavKey(key);
}

export async function removeSidebarNavKey(key: string) {
  const stored = await getStoredSidebarNavOrder();
  if (!stored?.includes(key)) return;
  await saveSidebarNavOrder(stored.filter((item) => item !== key));
}

export function buildAdminMenuRows(input: {
  order: string[];
  navItems: NavItemRecord[];
  iconMap: Record<string, string>;
}): AdminMenuRow[] {
  const navByCode = new Map(input.navItems.map((item) => [item.code, item]));
  const rows: AdminMenuRow[] = [];

  for (const key of input.order) {
    if (isSystemSidebarKey(key)) {
      const entry = SYSTEM_SIDEBAR_ENTRIES[key];
      rows.push({
        key,
        kind: "system",
        label: entry.label,
        href: entry.href,
        defaultIcon: entry.defaultIcon,
        iconKey: input.iconMap[key] ?? entry.defaultIcon,
        isActive: true,
        openInNewTab: key === "tsd",
        metaEntityCode: null,
      });
      continue;
    }

    const item = navByCode.get(key);
    if (!item) continue;

    rows.push({
      key,
      kind: "custom",
      label: item.label,
      href: navHrefForNavItem(item),
      defaultIcon: item.iconKey,
      iconKey: item.iconKey ?? input.iconMap[key] ?? "book",
      navItemId: item.id,
      isActive: item.isActive,
      openInNewTab: item.openInNewTab,
      metaEntityCode: item.metaEntityCode,
    });
  }

  return rows;
}

export async function loadAdminMenuRows(iconMap: Record<string, string>) {
  const navItems = await listNavItems();
  const navKeys = sortedNavItemKeys(navItems);
  const stored = await getStoredSidebarNavOrder();
  const order = resolveSidebarNavOrder(stored, navKeys);
  const rows = buildAdminMenuRows({ order, navItems, iconMap });
  return { rows, order };
}
