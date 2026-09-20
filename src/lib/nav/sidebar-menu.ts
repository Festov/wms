import type { NavItemRecord } from "@/lib/nav/helpers";

export const SYSTEM_SIDEBAR_KEYS = [
  "/",
  "nsi",
  "inbound",
  "outbound",
  "control",
  "operations",
  "admin",
  "tsd",
] as const;

export type SystemSidebarKey = (typeof SYSTEM_SIDEBAR_KEYS)[number];

export type SystemSidebarEntry = {
  key: SystemSidebarKey;
  label: string;
  defaultIcon: string;
  href: string;
};

export const SYSTEM_SIDEBAR_ENTRIES: Record<SystemSidebarKey, SystemSidebarEntry> =
  {
    "/": { key: "/", label: "Обзор", defaultIcon: "home", href: "/" },
    nsi: { key: "nsi", label: "НСИ", defaultIcon: "book", href: "/nsi" },
    inbound: {
      key: "inbound",
      label: "Приёмка",
      defaultIcon: "inbox",
      href: "/doc/inbound",
    },
    outbound: {
      key: "outbound",
      label: "Отгрузка",
      defaultIcon: "outbox",
      href: "/doc/outbound",
    },
    control: {
      key: "control",
      label: "Остатки",
      defaultIcon: "layers",
      href: "/inventory",
    },
    operations: {
      key: "operations",
      label: "Операции",
      defaultIcon: "layers",
      href: "/doc/operation",
    },
    admin: {
      key: "admin",
      label: "Администрирование",
      defaultIcon: "settings",
      href: "/admin",
    },
    tsd: { key: "tsd", label: "ТСД", defaultIcon: "scan", href: "/tsd" },
  };

export function parseSidebarNavOrder(raw: string | null | undefined): string[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const items = parsed.map((v) => String(v).trim()).filter(Boolean);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

export function serializeSidebarNavOrder(keys: string[]) {
  return JSON.stringify(keys);
}

export function buildDefaultSidebarOrder(navItemKeys: string[]): string[] {
  return [
    ...SYSTEM_SIDEBAR_KEYS.slice(0, 2),
    ...navItemKeys,
    ...SYSTEM_SIDEBAR_KEYS.slice(2),
  ];
}

export function mergeSidebarNavOrder(
  stored: string[] | null,
  available: string[],
  fallback: string[],
): string[] {
  const availableSet = new Set(available);
  const result: string[] = [];
  const seen = new Set<string>();

  if (stored) {
    for (const key of stored) {
      if (availableSet.has(key) && !seen.has(key)) {
        result.push(key);
        seen.add(key);
      }
    }
  }

  for (const key of fallback) {
    if (availableSet.has(key) && !seen.has(key)) {
      result.push(key);
      seen.add(key);
    }
  }

  for (const key of available) {
    if (!seen.has(key)) {
      result.push(key);
      seen.add(key);
    }
  }

  return result;
}

export function isSystemSidebarKey(key: string): key is SystemSidebarKey {
  return (SYSTEM_SIDEBAR_KEYS as readonly string[]).includes(key);
}

export function sortedNavItemKeys(
  items: Pick<NavItemRecord, "code" | "sortOrder" | "label">[],
) {
  return [...items]
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "ru"),
    )
    .map((item) => item.code);
}

export function resolveSidebarNavOrder(
  stored: string[] | null,
  navItemKeys: string[],
): string[] {
  const available = [...SYSTEM_SIDEBAR_KEYS, ...navItemKeys];
  const fallback = buildDefaultSidebarOrder(navItemKeys);
  return mergeSidebarNavOrder(stored, available, fallback);
}
