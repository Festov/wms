import type { ModuleCode } from "@/lib/modules/registry";
import {
  canAccessNavItem,
} from "@/lib/menu/permissions";
import {
  getModule,
  isModuleEnabled,
  type ModuleFlags,
} from "@/lib/modules/registry";
import type { NavLink } from "@/components/ui";
import type { NavItemRecord } from "@/lib/nav/helpers";
import { navHubHref, entityCodeFromNavItemCode } from "@/lib/nav/helpers";
import {
  isSystemSidebarKey,
  resolveSidebarNavOrder,
  SYSTEM_SIDEBAR_ENTRIES,
} from "@/lib/nav/sidebar-menu";
import { translateSidebarKey } from "@/lib/i18n/labels";

export type SidebarBuildContext = {
  modules: ModuleFlags;
  icons: Record<string, string>;
  allowedModules: Set<ModuleCode>;
  permissions: Set<string>;
  navItems: NavItemRecord[];
  catalogEntities: { code: string; navItemCode: string | null; kind: string }[];
  sidebarOrder: string[] | null;
};

function nsiCatalogPrefixes(
  catalogEntities: SidebarBuildContext["catalogEntities"],
) {
  return catalogEntities
    .filter((entity) => !entity.navItemCode && entity.kind === "catalog")
    .map((entity) => `/catalog/${entity.code}`);
}

function nsiDocumentPrefixes(
  catalogEntities: SidebarBuildContext["catalogEntities"],
) {
  return catalogEntities
    .filter((entity) => !entity.navItemCode && entity.kind === "document")
    .map((entity) => `/doc/${entity.code}`);
}

function catalogPrefixesForNavItem(
  navCode: string,
  catalogEntities: SidebarBuildContext["catalogEntities"],
) {
  return catalogEntities
    .filter((entity) => entity.navItemCode === navCode && entity.kind === "catalog")
    .map((entity) => `/catalog/${entity.code}`);
}

function documentPrefixesForNavItem(
  navCode: string,
  catalogEntities: SidebarBuildContext["catalogEntities"],
) {
  return catalogEntities
    .filter((entity) => entity.navItemCode === navCode && entity.kind === "document")
    .map((entity) => `/doc/${entity.code}`);
}

function isSidebarKeyVisible(key: string, ctx: SidebarBuildContext) {
  const allowed = ctx.allowedModules;
  if (key === "admin") return allowed.has("admin");
  if (key === "inbound") return ctx.modules.inbound && allowed.has("inbound");
  if (key === "outbound") return ctx.modules.outbound && allowed.has("outbound");
  if (key === "control") {
    return (
      isModuleEnabled(getModule("inventory"), ctx.modules) &&
      allowed.has("inventory")
    );
  }
  if (key === "operations") {
    return (
      isModuleEnabled(getModule("operations"), ctx.modules) &&
      allowed.has("operations")
    );
  }
  if (key === "nsi") return allowed.has("nsi");
  if (key === "tsd") {
    return ctx.modules.tsd && allowed.has("tsd");
  }
  if (key === "/") return true;
  if (key.startsWith("nav:")) {
    const catalogCodes = ctx.catalogEntities
      .filter((entity) => entity.navItemCode === key && entity.kind === "catalog")
      .map((entity) => entity.code);
    const documentCodes = ctx.catalogEntities
      .filter((entity) => entity.navItemCode === key && entity.kind === "document")
      .map((entity) => entity.code);
    return (
      ctx.modules.menus &&
      ctx.allowedModules.has("menus") &&
      canAccessNavItem(key, ctx.permissions, catalogCodes, documentCodes) &&
      ctx.navItems.some((item) => item.code === key && item.isActive)
    );
  }
  if (isSystemSidebarKey(key)) return true;
  return false;
}

function buildLinkForKey(
  key: string,
  ctx: SidebarBuildContext,
  labelForKey: (key: string) => string,
): NavLink | null {
  if (isSystemSidebarKey(key)) {
    const entry = SYSTEM_SIDEBAR_ENTRIES[key];
    let iconKey = ctx.icons[key] ?? entry.defaultIcon;
    if (key === "/") {
      iconKey = ctx.icons["/"] ?? ctx.icons.home ?? entry.defaultIcon;
    }
    if (key === "nsi") {
      iconKey = ctx.icons.nsi ?? ctx.icons["/nsi"] ?? entry.defaultIcon;
    }
    if (key === "admin") {
      iconKey = ctx.icons.admin ?? ctx.icons.settings ?? entry.defaultIcon;
    }

    const link: NavLink = {
      href: entry.href,
      label: labelForKey(key),
      iconKey,
    };

    if (key === "nsi") {
      link.activePrefixes = [
        "/labels",
        "/topology",
        "/lots",
        ...nsiCatalogPrefixes(ctx.catalogEntities),
        ...nsiDocumentPrefixes(ctx.catalogEntities),
      ];
    }
    if (key === "admin") {
      link.activePrefixes = ["/settings"];
    }
    if (key === "tsd") {
      link.openInNewTab = true;
    }
    return link;
  }

  const item = ctx.navItems.find((row) => row.code === key && row.isActive);
  if (!item) return null;

  const navSlug = entityCodeFromNavItemCode(item.code);
  const hubHref = item.href.startsWith("/m/")
    ? item.href
    : navHubHref(navSlug);

  return {
    href: hubHref,
    label: item.label,
    iconKey: item.iconKey ?? ctx.icons[item.code] ?? "book",
    openInNewTab: item.openInNewTab,
    activePrefixes: [
      hubHref,
      ...catalogPrefixesForNavItem(item.code, ctx.catalogEntities),
      ...documentPrefixesForNavItem(item.code, ctx.catalogEntities),
      ...(item.activePrefixes ?? []),
    ],
  };
}

export function buildSidebarLinks(
  ctx: SidebarBuildContext,
  labelForKey: (key: string) => string = translateSidebarKeyFallback,
): NavLink[] {
  const navItemKeys = ctx.navItems.map((item) => item.code);
  const order = resolveSidebarNavOrder(ctx.sidebarOrder, navItemKeys);
  const links: NavLink[] = [];

  for (const key of order) {
    if (!isSidebarKeyVisible(key, ctx)) continue;
    const link = buildLinkForKey(key, ctx, labelForKey);
    if (link) links.push(link);
  }

  return links;
}

function translateSidebarKeyFallback(key: string) {
  if (isSystemSidebarKey(key)) {
    return SYSTEM_SIDEBAR_ENTRIES[key].label;
  }
  return key;
}

export function createSidebarLabelResolver(
  t: (key: string) => string,
): (key: string) => string {
  return (key) =>
    isSystemSidebarKey(key) ? translateSidebarKey(key, t) : key;
}
