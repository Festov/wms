import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import {
  getModule,
  isModuleEnabled,
  type ModuleCode,
  type ModuleFlags,
  type RoleCode,
} from "@/lib/modules/registry";
import {
  requirePermission,
  userHasModuleAccess,
  userHasPermission,
} from "@/lib/permissions/check";
import { moduleWritePermissionCode } from "@/lib/permissions/registry";
import { prisma } from "@/lib/db";

export { userCanWrite, userHasRole } from "@/lib/roles";

export async function getUserRolesFromDb(userId: string): Promise<RoleCode[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  return user?.roles.map((r) => r.role.code as RoleCode) ?? [];
}

export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const roles = await getUserRolesFromDb(session.user.id);
  return { ...session.user, roles };
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: RoleCode[]) {
  const user = await requireUser();
  const has = roles.some((r) => user.roles.includes(r));
  if (!has) {
    redirect("/forbidden");
  }
  return user;
}

export async function requireAdmin() {
  return requirePermission("module.admin");
}

export async function requireAdminWrite() {
  const user = await requireAdmin();
  const ok = await userHasPermission(user.id, "module.admin.write");
  if (!ok) redirect("/forbidden");
  return user;
}

export const getModuleFlags = cache(async (): Promise<ModuleFlags> => {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    return {
      inbound: settings?.moduleInbound ?? true,
      outbound: settings?.moduleOutbound ?? true,
      inventory: true,
      operations: settings?.moduleOperations ?? true,
      topology: settings?.moduleTopology ?? true,
      lots: settings?.moduleLots ?? true,
      menus: settings?.moduleMenus ?? true,
      tsd: settings?.moduleTsd ?? true,
    };
  } catch {
    return {
      inbound: true,
      outbound: true,
      inventory: true,
      operations: true,
      topology: true,
      lots: true,
      menus: true,
      tsd: true,
    };
  }
});

export async function requireModule(code: ModuleCode) {
  const user = await requireUser();
  const mod = getModule(code);
  const flags = await getModuleFlags();

  if (!isModuleEnabled(mod, flags)) {
    redirect(`/module-disabled?code=${code}`);
  }

  const ok = await userHasModuleAccess(user.id, code);
  if (!ok) redirect("/forbidden");

  return user;
}

/** Быстрая проверка флага модуля (без редиректа). */
export async function isModuleFlagEnabled(code: keyof ModuleFlags) {
  const flags = await getModuleFlags();
  return flags[code];
}

export async function requireModuleWrite(code: ModuleCode) {
  const user = await requireModule(code);
  const writeCode = moduleWritePermissionCode(code);
  if (!writeCode) redirect("/forbidden");
  const ok = await userHasPermission(user.id, writeCode);
  if (!ok) redirect("/forbidden");
  return user;
}
