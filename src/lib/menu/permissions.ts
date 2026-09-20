import { entityCodeFromNavItemCode } from "@/lib/nav/helpers";
import type { PermissionMatrixRow } from "@/lib/permissions/registry";

export const MENU_NAV_PREFIX = "menu.nav.";
export const MENU_CATALOG_PREFIX = "menu.catalog.";
export const MENU_DOCUMENT_PREFIX = "menu.document.";
export const NSI_CATALOG_PREFIX = "nsi.catalog.";
export const NSI_DOCUMENT_PREFIX = "nsi.document.";

export const LEGACY_MENUS_PERMISSION = "module.menus";
const LEGACY_NSI_CUSTOM_PERMISSION = "nsi.custom";

export type CustomUiPermissionContext = {
  navItems: { code: string; label: string }[];
  menuCatalogs: {
    code: string;
    name: string;
    pluralName: string | null;
    navItemCode: string;
  }[];
  nsiCatalogs: {
    code: string;
    name: string;
    pluralName: string | null;
  }[];
  menuDocuments: {
    code: string;
    name: string;
    pluralName: string | null;
    navItemCode: string;
  }[];
  nsiDocuments: {
    code: string;
    name: string;
    pluralName: string | null;
  }[];
};

export function navSlugFromCode(navCode: string) {
  return entityCodeFromNavItemCode(navCode);
}

export function navViewPermission(slug: string) {
  return `${MENU_NAV_PREFIX}${slug}`;
}

export function menuCatalogViewPermission(entityCode: string) {
  return `${MENU_CATALOG_PREFIX}${entityCode}`;
}

export function menuCatalogWritePermission(entityCode: string) {
  return `${MENU_CATALOG_PREFIX}${entityCode}.write`;
}

export function nsiCatalogViewPermission(entityCode: string) {
  return `${NSI_CATALOG_PREFIX}${entityCode}`;
}

export function nsiCatalogWritePermission(entityCode: string) {
  return `${NSI_CATALOG_PREFIX}${entityCode}.write`;
}

export function menuDocumentViewPermission(entityCode: string) {
  return `${MENU_DOCUMENT_PREFIX}${entityCode}`;
}

export function menuDocumentWritePermission(entityCode: string) {
  return `${MENU_DOCUMENT_PREFIX}${entityCode}.write`;
}

export function nsiDocumentViewPermission(entityCode: string) {
  return `${NSI_DOCUMENT_PREFIX}${entityCode}`;
}

export function nsiDocumentWritePermission(entityCode: string) {
  return `${NSI_DOCUMENT_PREFIX}${entityCode}.write`;
}

function isSafeSegment(value: string) {
  return /^[a-z][a-z0-9_]*$/.test(value);
}

function parsePrefixedCode(
  code: string,
  prefix: string,
  allowWrite: boolean,
): string | null {
  if (!code.startsWith(prefix)) return null;
  const rest = code.slice(prefix.length);
  if (!rest) return null;
  if (allowWrite && rest.endsWith(".write")) {
    const segment = rest.slice(0, -".write".length);
    return isSafeSegment(segment) ? segment : null;
  }
  if (!allowWrite && !rest.endsWith(".write") && isSafeSegment(rest)) {
    return rest;
  }
  return null;
}

export function isDynamicPermissionCode(code: string): boolean {
  return (
    parsePrefixedCode(code, MENU_NAV_PREFIX, false) !== null ||
    parsePrefixedCode(code, MENU_CATALOG_PREFIX, false) !== null ||
    parsePrefixedCode(code, MENU_CATALOG_PREFIX, true) !== null ||
    parsePrefixedCode(code, MENU_DOCUMENT_PREFIX, false) !== null ||
    parsePrefixedCode(code, MENU_DOCUMENT_PREFIX, true) !== null ||
    parsePrefixedCode(code, NSI_CATALOG_PREFIX, false) !== null ||
    parsePrefixedCode(code, NSI_CATALOG_PREFIX, true) !== null ||
    parsePrefixedCode(code, NSI_DOCUMENT_PREFIX, false) !== null ||
    parsePrefixedCode(code, NSI_DOCUMENT_PREFIX, true) !== null
  );
}

export function viewPermissionForDynamicWriteCode(
  writeCode: string,
): string | null {
  const menuCatalog = parsePrefixedCode(writeCode, MENU_CATALOG_PREFIX, true);
  if (menuCatalog) return menuCatalogViewPermission(menuCatalog);
  const menuDocument = parsePrefixedCode(writeCode, MENU_DOCUMENT_PREFIX, true);
  if (menuDocument) return menuDocumentViewPermission(menuDocument);
  const nsiCatalog = parsePrefixedCode(writeCode, NSI_CATALOG_PREFIX, true);
  if (nsiCatalog) return nsiCatalogViewPermission(nsiCatalog);
  const nsiDocument = parsePrefixedCode(writeCode, NSI_DOCUMENT_PREFIX, true);
  if (nsiDocument) return nsiDocumentViewPermission(nsiDocument);
  return null;
}

export function hasAnyMenuPermission(
  permissions: ReadonlySet<string> | readonly string[],
): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  for (const code of set) {
    if (
      code.startsWith(MENU_NAV_PREFIX) ||
      code.startsWith(MENU_CATALOG_PREFIX) ||
      code.startsWith(MENU_DOCUMENT_PREFIX)
    ) {
      return true;
    }
  }
  return false;
}

export function hasAnyNsiCustomCatalogPermission(
  permissions: ReadonlySet<string> | readonly string[],
): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  for (const code of set) {
    if (code.startsWith(NSI_CATALOG_PREFIX)) return true;
  }
  return false;
}

export function canAccessNavSlug(
  slug: string,
  permissions: ReadonlySet<string> | readonly string[],
): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  if (set.has(navViewPermission(slug))) return true;
  if (set.has(LEGACY_MENUS_PERMISSION)) return true;
  return false;
}

export function canAccessNavItem(
  navCode: string,
  permissions: ReadonlySet<string> | readonly string[],
  catalogEntityCodesInNav: readonly string[],
  documentEntityCodesInNav: readonly string[] = [],
): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  if (canAccessNavSlug(navSlugFromCode(navCode), set)) return true;
  if (
    catalogEntityCodesInNav.some((code) =>
      set.has(menuCatalogViewPermission(code)),
    )
  ) {
    return true;
  }
  return documentEntityCodesInNav.some((code) =>
    set.has(menuDocumentViewPermission(code)),
  );
}

export function catalogViewPermissionForEntity(
  entityCode: string,
  storage?: string,
  navItemCode?: string | null,
): string | null {
  if (storage !== "custom") return null;
  if (navItemCode) return menuCatalogViewPermission(entityCode);
  return nsiCatalogViewPermission(entityCode);
}

export function catalogWritePermissionForEntity(
  entityCode: string,
  storage?: string,
  navItemCode?: string | null,
): string | null {
  const view = catalogViewPermissionForEntity(
    entityCode,
    storage,
    navItemCode,
  );
  if (!view) return null;
  if (navItemCode) return menuCatalogWritePermission(entityCode);
  return nsiCatalogWritePermission(entityCode);
}

export function canAccessCustomDocumentEntity(
  entityCode: string,
  permissions: ReadonlySet<string> | readonly string[],
): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  return (
    set.has(menuDocumentViewPermission(entityCode)) ||
    set.has(nsiDocumentViewPermission(entityCode))
  );
}

export function documentViewPermissionForEntity(
  entityCode: string,
  storage?: string,
  navItemCode?: string | null,
): string | null {
  if (storage !== "custom") return null;
  if (navItemCode) return menuDocumentViewPermission(entityCode);
  return nsiDocumentViewPermission(entityCode);
}

export function documentWritePermissionForEntity(
  entityCode: string,
  storage?: string,
  navItemCode?: string | null,
): string | null {
  const view = documentViewPermissionForEntity(
    entityCode,
    storage,
    navItemCode,
  );
  if (!view) return null;
  if (navItemCode) return menuDocumentWritePermission(entityCode);
  return nsiDocumentWritePermission(entityCode);
}

export function canAccessCustomCatalogEntity(
  entityCode: string,
  permissions: ReadonlySet<string> | readonly string[],
): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  return (
    set.has(menuCatalogViewPermission(entityCode)) ||
    set.has(nsiCatalogViewPermission(entityCode))
  );
}


export function defaultEnabledForDynamicCode(
  roleCode: string,
  code: string,
  legacyMenusEnabled: boolean,
  legacyNsiCustomEnabled: boolean,
): boolean {
  if (roleCode === "admin") return true;
  if (roleCode === "viewer") {
    return !code.endsWith(".write");
  }
  if (roleCode === "operator") {
    return !code.startsWith("module.admin");
  }
  if (code.startsWith(MENU_NAV_PREFIX) || code.startsWith(MENU_CATALOG_PREFIX)) {
    return legacyMenusEnabled;
  }
  if (code.startsWith(MENU_DOCUMENT_PREFIX)) {
    return legacyMenusEnabled;
  }
  if (code.startsWith(NSI_CATALOG_PREFIX)) {
    return legacyNsiCustomEnabled;
  }
  if (code.startsWith(NSI_DOCUMENT_PREFIX)) {
    return legacyNsiCustomEnabled;
  }
  return false;
}

export function buildCustomUiMatrixRows(
  ctx: CustomUiPermissionContext,
): PermissionMatrixRow[] {
  const rows: PermissionMatrixRow[] = [];

  for (const item of ctx.navItems) {
    const slug = navSlugFromCode(item.code);
    rows.push({
      id: navViewPermission(slug),
      title: item.label,
      description: "Раздел меню",
      viewCode: navViewPermission(slug),
    });
  }

  for (const catalog of ctx.menuCatalogs) {
    rows.push({
      id: menuCatalogViewPermission(catalog.code),
      title: catalog.pluralName ?? catalog.name,
      description: "Справочник",
      viewCode: menuCatalogViewPermission(catalog.code),
      writeCode: menuCatalogWritePermission(catalog.code),
    });
  }

  for (const document of ctx.menuDocuments) {
    rows.push({
      id: menuDocumentViewPermission(document.code),
      title: document.pluralName ?? document.name,
      description: "Документ",
      viewCode: menuDocumentViewPermission(document.code),
      writeCode: menuDocumentWritePermission(document.code),
    });
  }

  return rows;
}

export function buildNsiCustomDocumentMatrixRows(
  ctx: CustomUiPermissionContext,
): PermissionMatrixRow[] {
  return ctx.nsiDocuments.map((document) => ({
    id: nsiDocumentViewPermission(document.code),
    title: document.pluralName ?? document.name,
    description: "Документ",
    viewCode: nsiDocumentViewPermission(document.code),
    writeCode: nsiDocumentWritePermission(document.code),
  }));
}

export function buildNsiCustomCatalogMatrixRows(
  ctx: CustomUiPermissionContext,
): PermissionMatrixRow[] {
  return ctx.nsiCatalogs.map((catalog) => ({
    id: nsiCatalogViewPermission(catalog.code),
    title: catalog.pluralName ?? catalog.name,
    description: "Справочник",
    viewCode: nsiCatalogViewPermission(catalog.code),
    writeCode: nsiCatalogWritePermission(catalog.code),
  }));
}

export const LEGACY_MENU_PERMISSION_CODES = [
  LEGACY_MENUS_PERMISSION,
  "module.menus.write",
  LEGACY_NSI_CUSTOM_PERMISSION,
  "nsi.custom.write",
] as const;
