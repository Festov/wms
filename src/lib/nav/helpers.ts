export type NavItemRecord = {
  id: string;
  code: string;
  label: string;
  href: string;
  iconKey: string;
  sortOrder: number;
  isActive: boolean;
  openInNewTab: boolean;
  activePrefixes: string[] | null;
  metaEntityCode: string | null;
};

export function parseActivePrefixes(raw: string | null): string[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const items = parsed
      .map((v) => String(v).trim())
      .filter((v) => v.startsWith("/") && !v.startsWith("//"));
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

export function serializeActivePrefixes(prefixes: string[] | null | undefined) {
  if (!prefixes?.length) return null;
  const items = prefixes
    .map((v) => v.trim())
    .filter((v) => v.startsWith("/") && !v.startsWith("//"));
  return items.length > 0 ? JSON.stringify(items) : null;
}

export function navItemIconCode(code: string) {
  return code.startsWith("nav:") ? code : `nav:${code}`;
}

export function catalogNavHref(entityCode: string) {
  return `/catalog/${entityCode}`;
}

export function documentNavHref(entityCode: string) {
  return `/doc/${entityCode}`;
}

export function navHubHref(navSlug: string) {
  return `/m/${navSlug}`;
}

export function entityCodeFromNavItemCode(navCode: string) {
  return navCode.replace(/^nav:/, "");
}

export function navHrefForNavItem(item: { code: string; href?: string }) {
  if (item.href?.startsWith("/m/")) return item.href;
  return navHubHref(entityCodeFromNavItemCode(item.code));
}

export function defaultNavItemCodeForEntity(entityCode: string) {
  return `nav:${entityCode}`;
}
