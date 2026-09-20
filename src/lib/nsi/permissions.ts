import { localized } from "@/lib/i18n/errors";
import {
  canAccessCustomCatalogEntity,
  hasAnyNsiCustomCatalogPermission,
  nsiCatalogViewPermission,
  nsiCatalogWritePermission,
} from "@/lib/menu/permissions";
import type { PermissionCode } from "@/lib/permissions/registry";

/** Системные справочники внутри НСИ (код MetaEntity / catalog). */
export const NSI_CATALOG_ENTRIES = [
  {
    code: "nsi.nomenclature",
    entityCode: "nomenclature",
    title: "Номенклатура",
    description: "SKU, упаковки, карточки товаров",
  },
  {
    code: "nsi.counterparties",
    entityCode: "counterparties",
    title: "Контрагенты",
    description: "Поставщики и клиенты",
  },
  {
    code: "nsi.receiving_docks",
    entityCode: "receiving_docks",
    title: "Рампы",
    description: "Рампы приёмки и отгрузки",
  },
  {
    code: "nsi.transport_units",
    entityCode: "transport_units",
    title: "Транспорт",
    description: "Транспортные средства и водители",
  },
  {
    code: "nsi.zones",
    entityCode: "zones",
    title: "Зоны",
    description: "Зоны склада",
  },
  {
    code: "nsi.cells",
    entityCode: "cells",
    title: "Ячейки",
    description: "Адресное хранение",
  },
  {
    code: "nsi.pallet_types",
    entityCode: "pallet_types",
    title: "Типы ТН",
    description: "EUR и другие типы носителей",
  },
  {
    code: "nsi.pallets",
    entityCode: "pallets",
    title: "ТН",
    description: "Паллеты и товарные носители",
  },
  {
    code: "nsi.packages",
    entityCode: "packages",
    title: "Упаковки",
    description: "Коэффициенты и ВГХ",
  },
  {
    code: "nsi.units",
    entityCode: "units",
    title: "Единицы",
    description: "Базовые единицы измерения",
  },
  {
    code: "nsi.accounting_models",
    entityCode: "accounting_models",
    title: "Модели учёта",
    description: "Схемы учёта остатков",
  },
  {
    code: "nsi.labels",
    entityCode: "labels",
    title: "Штрихкоды",
    description: "Справочник и печать",
  },
] as const;

export const NSI_HUB_PERMISSION = "nsi.hub" as const;

export const NSI_WRITE_PERMISSION_CODES = [
  ...NSI_CATALOG_ENTRIES.map((e) => `${e.code}.write` as const),
] as const;

export const NSI_PERMISSION_CODES = [
  NSI_HUB_PERMISSION,
  ...NSI_CATALOG_ENTRIES.map((e) => e.code),
] as const;

const SYSTEM_ENTITY_CODES = new Set(
  NSI_CATALOG_ENTRIES.map((e) => e.entityCode).filter(Boolean) as string[],
);

const PERMISSION_BY_ENTITY = new Map(
  NSI_CATALOG_ENTRIES.filter((e) => "entityCode" in e && e.entityCode).map(
    (e) => [e.entityCode as string, e.code],
  ),
);

const PERMISSION_BY_PATH = new Map<string, PermissionCode>([
  ["/labels", "nsi.labels"],
]);

export function nsiPermissionForEntity(
  entityCode: string,
  storage?: string,
  navItemCode?: string | null,
): PermissionCode {
  if (navItemCode) {
    throw new Error(
      localized("errors.permissions.useCatalogViewPermission"),
    );
  }
  if (storage === "custom" || !SYSTEM_ENTITY_CODES.has(entityCode)) {
    return nsiCatalogViewPermission(entityCode) as PermissionCode;
  }
  return (
    PERMISSION_BY_ENTITY.get(entityCode) ??
    (nsiCatalogViewPermission(entityCode) as PermissionCode)
  );
}

export function nsiWritePermissionForEntity(
  entityCode: string,
  storage?: string,
  navItemCode?: string | null,
): PermissionCode | null {
  if (navItemCode) return null;
  const view = nsiPermissionForEntity(entityCode, storage, navItemCode);
  if (view === NSI_HUB_PERMISSION) return null;
  if (view.startsWith("nsi.catalog.")) {
    return nsiCatalogWritePermission(entityCode) as PermissionCode;
  }
  return `${view}.write` as PermissionCode;
}

export function nsiPermissionForPath(pathname: string): PermissionCode | null {
  if (pathname === "/nsi" || pathname === "/nsi/") {
    return NSI_HUB_PERMISSION;
  }
  if (pathname === "/labels" || pathname.startsWith("/labels/")) {
    return PERMISSION_BY_PATH.get("/labels") ?? null;
  }
  const catalogMatch = pathname.match(/^\/catalog\/([^/]+)/);
  if (catalogMatch) {
    const entityCode = catalogMatch[1];
    if (SYSTEM_ENTITY_CODES.has(entityCode)) {
      return PERMISSION_BY_ENTITY.get(entityCode) ?? null;
    }
    return nsiCatalogViewPermission(entityCode) as PermissionCode;
  }
  return null;
}

export function hasAnyNsiPermission(
  permissions: ReadonlySet<PermissionCode> | readonly PermissionCode[],
): boolean {
  const set =
    permissions instanceof Set ? permissions : new Set(permissions);
  for (const code of NSI_PERMISSION_CODES) {
    if (set.has(code)) return true;
  }
  return false;
}

function hasAnyCatalogNsiPermission(set: Set<PermissionCode>) {
  for (const entry of NSI_CATALOG_ENTRIES) {
    if (set.has(entry.code)) return true;
  }
  if (hasAnyNsiCustomCatalogPermission(set)) return true;
  return false;
}

export function canAccessNsiPath(
  pathname: string,
  permissions: ReadonlySet<PermissionCode> | readonly PermissionCode[],
): boolean {
  const set =
    permissions instanceof Set ? permissions : new Set(permissions);
  const need = nsiPermissionForPath(pathname);
  if (!need) return hasAnyNsiPermission(set);
  if (need === NSI_HUB_PERMISSION) {
    return set.has(NSI_HUB_PERMISSION) || hasAnyCatalogNsiPermission(set);
  }
  const catalogMatch = pathname.match(/^\/catalog\/([^/]+)/);
  if (catalogMatch) {
    const entityCode = catalogMatch[1];
    if (SYSTEM_ENTITY_CODES.has(entityCode)) {
      return set.has(need);
    }
    return canAccessCustomCatalogEntity(entityCode, set);
  }
  return set.has(need);
}

export function filterByNsiPermissions<
  T extends { href: string; entityCode?: string },
>(entries: T[], permissions: ReadonlySet<PermissionCode>): T[] {
  return entries.filter((entry) => {
    if (entry.href === "/nsi") {
      return (
        permissions.has(NSI_HUB_PERMISSION) ||
        hasAnyCatalogNsiPermission(new Set(permissions))
      );
    }
    if (entry.entityCode) {
      return permissions.has(
        nsiPermissionForEntity(entry.entityCode, "system"),
      );
    }
    const perm = PERMISSION_BY_PATH.get(entry.href);
    return perm ? permissions.has(perm) : true;
  });
}
