import type { ModuleCode } from "@/lib/modules/registry";
import {
  catalogViewPermissionForEntity,
  catalogWritePermissionForEntity,
  documentViewPermissionForEntity,
  documentWritePermissionForEntity,
  menuDocumentViewPermission,
  nsiDocumentViewPermission,
} from "@/lib/menu/permissions";
import {
  nsiPermissionForEntity,
  nsiWritePermissionForEntity,
} from "@/lib/nsi/permissions";
import {
  documentViewPermission,
  documentWritePermission,
  modulePermissionCode,
  moduleWritePermissionCode,
} from "@/lib/permissions/registry";
import { getMetaEntity } from "@/lib/meta/catalog";
import {
  documentModuleForEntity,
  isSystemDocumentEntity,
} from "@/lib/meta/document-registry";

export type EntityPermissionAction = "view" | "write";

const MODULE_ALIASES: Record<string, string[]> = {
  "module.inbound": ["document.inbound"],
  "module.inbound.write": ["document.inbound.write"],
  "module.outbound": ["document.outbound"],
  "module.outbound.write": ["document.outbound.write"],
  "module.operations": ["document.operation"],
  "module.operations.write": ["document.operation.write"],
};

const REVERSE_ALIASES: Record<string, string[]> = Object.fromEntries(
  Object.entries(MODULE_ALIASES).flatMap(([canonical, aliases]) =>
    aliases.map((alias) => [alias, [canonical]]),
  ),
);

export function expandPermissionAliases(code: string): string[] {
  return [...(MODULE_ALIASES[code] ?? []), ...(REVERSE_ALIASES[code] ?? [])];
}

export function hasPermissionWithAliases(
  permissions: ReadonlySet<string> | readonly string[],
  code: string,
): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  if (set.has(code)) return true;
  return expandPermissionAliases(code).some((alias) => set.has(alias));
}

export async function permissionForEntity(
  entityCode: string,
  action: EntityPermissionAction,
): Promise<string | null> {
  if (isSystemDocumentEntity(entityCode)) {
    return action === "view"
      ? documentViewPermission(entityCode)
      : documentWritePermission(entityCode);
  }

  const entity = await getMetaEntity(entityCode);
  if (!entity) return null;

  if (entity.kind === "catalog") {
    if (entity.storage === "system") {
      return action === "view"
        ? nsiPermissionForEntity(entityCode)
        : nsiWritePermissionForEntity(entityCode);
    }
    return action === "view"
      ? catalogViewPermissionForEntity(entityCode, entity.storage, entity.navItemCode)
      : catalogWritePermissionForEntity(entityCode, entity.storage, entity.navItemCode);
  }

  if (entity.kind === "document" || entity.kind === "journal") {
    if (entity.storage === "system") {
      return action === "view"
        ? documentViewPermission(entityCode)
        : documentWritePermission(entityCode);
    }
    return action === "view"
      ? documentViewPermissionForEntity(entityCode, entity.storage, entity.navItemCode)
      : documentWritePermissionForEntity(entityCode, entity.storage, entity.navItemCode);
  }

  return null;
}

export function modulePermissionForDocumentEntity(entityCode: string): string | null {
  const mod = documentModuleForEntity(entityCode);
  if (!mod) return null;
  return modulePermissionCode(mod);
}

export function moduleWritePermissionForDocumentEntity(
  entityCode: string,
): string | null {
  const mod = documentModuleForEntity(entityCode);
  if (!mod) return null;
  return moduleWritePermissionCode(mod);
}

export function canAccessDocumentEntity(
  entityCode: string,
  permissions: ReadonlySet<string> | readonly string[],
): boolean {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  const mod = documentModuleForEntity(entityCode);
  if (mod) {
    return hasPermissionWithAliases(set, modulePermissionCode(mod));
  }
  const docPerm = documentViewPermission(entityCode);
  if (hasPermissionWithAliases(set, docPerm)) return true;
  return (
    set.has(menuDocumentViewPermission(entityCode)) ||
    set.has(nsiDocumentViewPermission(entityCode))
  );
}

export function documentModuleCode(entityCode: string): ModuleCode | null {
  return documentModuleForEntity(entityCode);
}
