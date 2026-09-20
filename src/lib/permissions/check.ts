import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { MODULE_REGISTRY, type ModuleCode } from "@/lib/modules/registry";
import {
  canAccessNsiPath,
  hasAnyNsiPermission,
} from "@/lib/nsi/permissions";
import {
  canAccessNavItem,
  canAccessNavSlug,
  defaultEnabledForDynamicCode,
  hasAnyMenuPermission,
} from "@/lib/menu/permissions";
import { navItemIconCode } from "@/lib/nav/helpers";
import { collectDynamicPermissionCodes } from "@/lib/menu/permissions.server";
import {
  DEFAULT_CUSTOM_ROLE_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  isPermissionCode,
  modulePermissionCode,
  moduleWritePermissionCode,
  PERMISSION_CODES,
  type PermissionCode,
  viewPermissionForWriteCode,
} from "@/lib/permissions/registry";
import { requireUser } from "@/lib/session";
import {
  hasPermissionWithAliases,
  permissionForEntity,
  type EntityPermissionAction,
} from "@/lib/permissions/entity-permissions";

async function userHasAdminRole(userId: string): Promise<boolean> {
  const row = await prisma.userRole.findFirst({
    where: { userId, role: { code: "admin" } },
  });
  return Boolean(row);
}

/** Единственные системные роли; остальные создаёт администратор. */
export const SYSTEM_ROLE_CODES = ["admin", "operator", "viewer"] as const;

export async function ensureSystemRoles() {
  const systemRoles = [
    {
      code: "admin",
      name: "Администратор",
      description: "Полный доступ",
    },
    {
      code: "operator",
      name: "Оператор",
      description: "Складские операции без админки",
    },
    {
      code: "viewer",
      name: "Просмотр",
      description: "Только чтение",
    },
  ] as const;

  for (const role of systemRoles) {
    await prisma.role.upsert({
      where: { code: role.code },
      create: { ...role, isSystem: true },
      update: {
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });
  }

  await prisma.role.updateMany({
    where: { code: { notIn: [...SYSTEM_ROLE_CODES] } },
    data: { isSystem: false },
  });
}

/** Bump when PERMISSION_CODES or dynamic-permission defaults change. */
const PERMISSIONS_SEED_REV = 3;
const PERMISSIONS_SEED_KEY = "permissionsSeedRev";

/** Создаёт недостающие RolePermission с дефолтами по коду роли. */
export async function ensureRolePermissions() {
  const g = globalThis as typeof globalThis & {
    __wmsPermissionsEnsured?: boolean;
  };
  if (g.__wmsPermissionsEnsured) return;

  const stored = await prisma.appSetting.findUnique({
    where: { key: PERMISSIONS_SEED_KEY },
  });
  if (stored && Number(stored.value) >= PERMISSIONS_SEED_REV) {
    g.__wmsPermissionsEnsured = true;
    return;
  }

  await ensureSystemRoles();

  const roles = await prisma.role.findMany({
    include: { permissions: true },
  });

  for (const role of roles) {
    const defaults =
      DEFAULT_ROLE_PERMISSIONS[role.code] ?? DEFAULT_CUSTOM_ROLE_PERMISSIONS;
    const existing = new Set(role.permissions.map((p) => p.code));
    const legacyControl = role.permissions.find(
      (p) => p.code === "module.control",
    );
    const legacyWebWrite = role.permissions.find((p) => p.code === "web.write");
    const legacyMenus = role.permissions.find(
      (p) => p.code === "module.menus",
    );
    const legacyNsiCustom = role.permissions.find(
      (p) => p.code === "nsi.custom",
    );

    for (const code of PERMISSION_CODES) {
      if (existing.has(code)) continue;
      let enabled = defaults[code] ?? false;
      if (
        legacyControl &&
        (code === "module.inventory" || code === "module.operations")
      ) {
        enabled = legacyControl.enabled;
      }
      if (code.endsWith(".write")) {
        const viewCode = viewPermissionForWriteCode(code);
        if (viewCode) {
          const viewPerm = role.permissions.find((p) => p.code === viewCode);
          const viewEnabled =
            viewPerm?.enabled ?? defaults[viewCode] ?? false;
          if (legacyWebWrite) {
            enabled = legacyWebWrite.enabled && viewEnabled;
          } else if (viewPerm) {
            enabled = viewPerm.enabled;
          }
        }
      }
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          code,
          enabled,
        },
      });
    }

    const dynamicCodes = await collectDynamicPermissionCodes();
    for (const code of dynamicCodes) {
      if (existing.has(code)) continue;
      const enabled = defaultEnabledForDynamicCode(
        role.code,
        code,
        legacyMenus?.enabled ?? false,
        legacyNsiCustom?.enabled ?? false,
      );
      await prisma.rolePermission.create({
        data: { roleId: role.id, code, enabled },
      });
    }
  }

  await prisma.appSetting.upsert({
    where: { key: PERMISSIONS_SEED_KEY },
    create: {
      key: PERMISSIONS_SEED_KEY,
      value: String(PERMISSIONS_SEED_REV),
    },
    update: { value: String(PERMISSIONS_SEED_REV) },
  });
  g.__wmsPermissionsEnsured = true;
}

export async function getEffectivePermissionSet(
  userId: string,
  roles: readonly string[] = [],
): Promise<Set<PermissionCode>> {
  if (roles.includes("admin")) {
    const dynamic = await collectDynamicPermissionCodes();
    return new Set([...PERMISSION_CODES, ...dynamic] as PermissionCode[]);
  }
  return getUserPermissionSet(userId);
}

export async function getUserPermissionSet(
  userId: string,
): Promise<Set<PermissionCode>> {
  let rows = await prisma.rolePermission.findMany({
    where: {
      enabled: true,
      role: { users: { some: { userId } } },
    },
    select: { code: true },
  });

  if (rows.length === 0 && (await userHasAdminRole(userId))) {
    await ensureRolePermissions();
    rows = await prisma.rolePermission.findMany({
      where: {
        enabled: true,
        role: { users: { some: { userId } } },
      },
      select: { code: true },
    });
  }

  const set = new Set<PermissionCode>();
  for (const row of rows) {
    if (isPermissionCode(row.code)) {
      set.add(row.code);
    }
  }
  return set;
}

export async function userHasPermission(
  userId: string,
  code: PermissionCode,
): Promise<boolean> {
  if (await userHasAdminRole(userId)) return true;
  const set = await getUserPermissionSet(userId);
  return hasPermissionWithAliases(set, code);
}

export async function userHasEntityPermission(
  userId: string,
  entityCode: string,
  action: EntityPermissionAction,
): Promise<boolean> {
  const need = await permissionForEntity(entityCode, action);
  if (!need) return false;
  return userHasPermission(userId, need);
}

export async function requireEntityPermission(
  entityCode: string,
  action: EntityPermissionAction,
) {
  const user = await requireUser();
  const ok = await userHasEntityPermission(user.id, entityCode, action);
  if (!ok) redirect("/forbidden");
  return user;
}

export async function requirePermission(code: PermissionCode) {
  const user = await requireUser();
  const ok = await userHasPermission(user.id, code);
  if (!ok) redirect("/forbidden");
  return user;
}

export async function userHasModuleAccess(
  userId: string,
  code: ModuleCode,
): Promise<boolean> {
  if (code === "nsi") {
    const perms = await getUserPermissionSet(userId);
    return hasAnyNsiPermission(perms);
  }
  if (code === "menus") {
    const perms = await getUserPermissionSet(userId);
    return hasAnyMenuPermission(perms);
  }
  return userHasPermission(userId, modulePermissionCode(code));
}

export async function requireNsiCatalog(
  entityCode: string,
  ..._legacy: unknown[]
) {
  void _legacy;
  return requireEntityPermission(entityCode, "view");
}

export async function requireNsiCatalogWrite(
  entityCode: string,
  ..._legacy: unknown[]
) {
  void _legacy;
  return requireEntityPermission(entityCode, "write");
}

export async function requireCustomDocument(
  entityCode: string,
  ..._legacy: unknown[]
) {
  void _legacy;
  return requireEntityPermission(entityCode, "view");
}

export async function requireCustomDocumentWrite(
  entityCode: string,
  ..._legacy: unknown[]
) {
  void _legacy;
  return requireEntityPermission(entityCode, "write");
}

export async function requireNavAccess(navSlug: string) {
  const user = await requireUser();
  const perms = await getUserPermissionSet(user.id);
  if (canAccessNavSlug(navSlug, perms)) return user;

  const navCode = navItemIconCode(navSlug);
  const entities = await prisma.metaEntity.findMany({
    where: { navItemCode: navCode, storage: "custom", isActive: true },
    select: { code: true, kind: true },
  });
  if (
    canAccessNavItem(
      navCode,
      perms,
      entities.filter((row) => row.kind === "catalog").map((row) => row.code),
      entities.filter((row) => row.kind === "document").map((row) => row.code),
    )
  ) {
    return user;
  }

  redirect("/forbidden");
}

export async function userHasModuleWriteAccess(
  userId: string,
  code: ModuleCode,
): Promise<boolean> {
  const writeCode = moduleWritePermissionCode(code);
  if (!writeCode) return false;
  if (!(await userHasModuleAccess(userId, code))) return false;
  return userHasPermission(userId, writeCode);
}

export async function requireNsiSection() {
  const user = await requireUser();
  const perms = await getUserPermissionSet(user.id);
  if (!canAccessNsiPath("/nsi", perms)) redirect("/forbidden");
  return user;
}

export async function getUserAllowedModules(
  userId: string,
): Promise<Set<ModuleCode>> {
  if (await userHasAdminRole(userId)) {
    return new Set(MODULE_REGISTRY.map((m) => m.code));
  }

  const perms = await getUserPermissionSet(userId);
  const allowed = new Set<ModuleCode>();
  for (const mod of MODULE_REGISTRY) {
    if (mod.code === "nsi") {
      if (hasAnyNsiPermission(perms)) allowed.add("nsi");
      continue;
    }
    if (mod.code === "topology" || mod.code === "lots") {
      if (hasPermissionWithAliases(perms, modulePermissionCode(mod.code))) {
        allowed.add(mod.code);
      }
      continue;
    }
    if (mod.code === "menus") {
      if (hasAnyMenuPermission(perms)) allowed.add("menus");
      continue;
    }
    if (hasPermissionWithAliases(perms, modulePermissionCode(mod.code))) {
      allowed.add(mod.code);
    }
  }
  return allowed;
}
