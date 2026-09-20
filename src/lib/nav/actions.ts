"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { throwLocalized } from "@/lib/i18n/errors-server";
import { requireAdminWrite } from "@/lib/session";
import { ensureRolePermissions } from "@/lib/permissions/check";
import {
  assertValidEntityCode,
  sanitizeEntityCode,
} from "@/lib/entity-code";
import {
  entityCodeFromNavItemCode,
  navHubHref,
  navItemIconCode,
  serializeActivePrefixes,
} from "@/lib/nav/catalog";
import {
  appendSidebarNavKey,
  getStoredSidebarNavOrder,
  removeSidebarNavKey,
  saveSidebarNavOrder,
} from "@/lib/nav/admin-menu";
import {
  resolveSidebarNavOrder,
  sortedNavItemKeys,
} from "@/lib/nav/sidebar-menu";

function revalidateNavPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/nav");
}

function parseEntityCode(raw: string) {
  const entityCode = sanitizeEntityCode(raw.replace(/^nav:/, ""));
  assertValidEntityCode(entityCode);
  return entityCode;
}

function hrefForNavSlug(navSlug: string) {
  return navHubHref(navSlug);
}

export async function createNavItem(formData: FormData) {
  await requireAdminWrite();
  const navSlug = parseEntityCode(String(formData.get("code") ?? ""));
  const code = navItemIconCode(navSlug);
  const href = hrefForNavSlug(navSlug);
  const label = String(formData.get("label") ?? "").trim();
  const iconKey = String(formData.get("iconKey") ?? "grid").trim() || "grid";
  const maxSort = await prisma.navItem.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 10;
  const activePrefixes = serializeActivePrefixes([href]);

  if (!label) return throwLocalized("errors.nav.nameRequired");

  await prisma.navItem.create({
    data: {
      code,
      label,
      href,
      iconKey,
      sortOrder,
      openInNewTab: false,
      activePrefixes,
      metaEntityCode: null,
    },
  });

  await appendSidebarNavKey(code);
  await ensureRolePermissions();
  revalidateNavPaths();
  revalidatePath("/admin/roles");
}

export async function updateNavItem(id: string, formData: FormData) {
  await requireAdminWrite();
  const item = await prisma.navItem.findUnique({ where: { id } });
  if (!item) return throwLocalized("errors.nav.itemNotFound");

  const label = formData.has("label")
    ? String(formData.get("label") ?? "").trim()
    : item.label;
  const iconKey = formData.has("iconKey")
    ? String(formData.get("iconKey") ?? "grid").trim() || "grid"
    : item.iconKey;
  const isActive = formData.has("isActive")
    ? formData.get("isActive") === "on"
    : item.isActive;

  let navSlug = entityCodeFromNavItemCode(item.code);
  if (formData.has("code")) {
    navSlug = parseEntityCode(String(formData.get("code") ?? ""));
  }

  const newCode = navItemIconCode(navSlug);
  const href = hrefForNavSlug(navSlug);
  const oldCode = item.code;

  if (newCode !== oldCode) {
    const exists = await prisma.navItem.findUnique({ where: { code: newCode } });
    if (exists && exists.id !== id) {
      return throwLocalized("errors.nav.itemCodeExists");
    }
    const order = await getStoredSidebarNavOrder();
    if (order) {
      await saveSidebarNavOrder(
        order.map((key) => (key === oldCode ? newCode : key)),
      );
    }
    await prisma.metaEntity.updateMany({
      where: { navItemCode: oldCode },
      data: { navItemCode: newCode },
    });
  }

  if (!label) return throwLocalized("errors.nav.nameRequired");

  await prisma.navItem.update({
    where: { id },
    data: {
      code: newCode,
      label,
      href,
      iconKey,
      isActive,
      openInNewTab: false,
      activePrefixes: serializeActivePrefixes([href]),
    },
  });

  revalidateNavPaths();
  if (newCode !== oldCode) {
    await ensureRolePermissions();
    revalidatePath("/admin/roles");
  }
}

export async function moveSidebarNavEntry(
  key: string,
  direction: "up" | "down",
) {
  await requireAdminWrite();
  const [stored, navItems] = await Promise.all([
    getStoredSidebarNavOrder(),
    prisma.navItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { code: true, sortOrder: true, label: true },
    }),
  ]);
  const navKeys = sortedNavItemKeys(navItems);
  const order = resolveSidebarNavOrder(stored, navKeys);
  const index = order.indexOf(key);
  if (index < 0) return throwLocalized("errors.nav.itemNotFound");
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= order.length) return;

  [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  await saveSidebarNavOrder(order);
  revalidateNavPaths();
}

export async function deleteNavItem(id: string) {
  await requireAdminWrite();
  const item = await prisma.navItem.findUnique({ where: { id } });
  if (!item) return;
  await prisma.metaEntity.updateMany({
    where: { navItemCode: item.code },
    data: { navItemCode: null },
  });
  await prisma.navItem.delete({ where: { id } });
  await removeSidebarNavKey(item.code);
  await ensureRolePermissions();
  revalidateNavPaths();
  revalidatePath("/admin/roles");
}
