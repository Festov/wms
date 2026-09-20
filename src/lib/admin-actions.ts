"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { throwActionError, getApiLocale } from "@/lib/i18n/locale-server";
import { throwLocalized } from "@/lib/i18n/errors-server";
import { serializeLabelsJson } from "@/lib/i18n/resolve-label";
import { requireAdminWrite } from "@/lib/session";
import { updateSettings as updateSettingsBase } from "@/lib/actions";

export async function updateSettingsSecure(formData: FormData) {
  await requireAdminWrite();
  await updateSettingsBase(formData);
}

export async function createUser(formData: FormData) {
  await requireAdminWrite();
  const login = String(formData.get("login") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roleCode = String(formData.get("role") ?? "").trim();
  if (!login || !name || !password || !roleCode) {
    return throwLocalized("errors.admin.fillAllFieldsAndRole");
  }
  if (password.length < 8) {
    await throwActionError("passwordTooShort");
  }
  if (password === "admin123" || password === "change-me-in-production") {
    await throwActionError("passwordTooWeak");
  }

  const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email: login,
      name,
      passwordHash,
      roles: { create: [{ roleId: role.id }] },
    },
  });
  revalidatePath("/admin/users");
}

export async function setUserRole(formData: FormData) {
  await requireAdminWrite();
  const userId = String(formData.get("userId") ?? "");
  const roleCode = String(formData.get("role") ?? "");
  const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
  await prisma.userRole.deleteMany({ where: { userId } });
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
  revalidatePath("/admin/users");
}

export async function toggleUserActive(formData: FormData) {
  await requireAdminWrite();
  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });
  revalidatePath("/admin/users");
}

export async function saveRolePermissionsForRole(formData: FormData) {
  await requireAdminWrite();
  const roleId = String(formData.get("roleId") ?? "");
  if (!roleId) return throwLocalized("errors.admin.roleNotSpecified");

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return throwLocalized("errors.admin.roleNotFound");

  const { ensureRolePermissions } = await import("@/lib/permissions/check");
  const { PERMISSION_CODES } = await import("@/lib/permissions/registry");
  const { collectDynamicPermissionCodes } = await import(
    "@/lib/menu/permissions.server"
  );
  await ensureRolePermissions();

  const allCodes = [
    ...PERMISSION_CODES,
    ...(await collectDynamicPermissionCodes()),
  ];

  for (const code of allCodes) {
    const enabled = formData.get(`perm:${code}`) === "1";
    await prisma.rolePermission.upsert({
      where: { roleId_code: { roleId, code } },
      create: { roleId, code, enabled },
      update: { enabled },
    });
  }

  revalidatePath("/admin/roles");
  revalidatePath("/", "layout");
  revalidatePath("/tsd");
  revalidatePath("/tsd/putaway");
  revalidatePath("/tsd/receive");
  revalidatePath("/tsd/pick");
  revalidatePath("/tsd/transfer");
}

export async function createRole(formData: FormData) {
  await requireAdminWrite();
  const code = String(formData.get("code") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!code || !/^[a-z][a-z0-9_]*$/.test(code)) {
    return throwLocalized("errors.admin.roleCodeInvalid");
  }
  if (!name) return throwLocalized("errors.admin.roleNameRequired");

  const exists = await prisma.role.findUnique({ where: { code } });
  if (exists) return throwLocalized("errors.admin.roleCodeExists");

  await prisma.role.create({
    data: { code, name, description, isSystem: false },
  });

  const { ensureRolePermissions } = await import("@/lib/permissions/check");
  await ensureRolePermissions();
  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
}

export async function deleteRole(formData: FormData) {
  await requireAdminWrite();
  const roleId = String(formData.get("roleId") ?? "");
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { _count: { select: { users: true } } },
  });
  if (!role) return;
  if (role.isSystem) return throwLocalized("errors.admin.systemRoleCannotDelete");
  if (role._count.users > 0) {
    return throwLocalized("errors.admin.roleHasUsers");
  }
  await prisma.role.delete({ where: { id: roleId } });
  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
}

export async function saveStatusStreams(formData: FormData) {
  await requireAdminWrite();
  const locale = await getApiLocale();
  const { ensureStatuses } = await import("@/lib/status/seed");
  await ensureStatuses(prisma);

  const statuses = await prisma.status.findMany({
    select: { id: true, name: true, labelsJson: true },
  });
  const streamKeys = [
    "forInbound",
    "forOutbound",
    "forPutaway",
    "forPallet",
    "forTransfer",
  ] as const;
  const colorKeys = ["colorBg", "colorFg", "colorBorder"] as const;

  for (const st of statuses) {
    const name = String(formData.get(`name:${st.id}`) ?? "").trim();
    const data: Record<string, boolean | string> = {
      isActive: formData.get(`isActive:${st.id}`) === "1",
    };
    if (name) {
      if (locale === "ru") {
        data.name = name;
      }
      let labels: Partial<Record<"ru" | "en", string>> = {};
      if (st.labelsJson) {
        try {
          labels = JSON.parse(st.labelsJson) as Partial<
            Record<"ru" | "en", string>
          >;
        } catch {
          labels = {};
        }
      }
      labels[locale] = name;
      if (locale === "ru") {
        labels.ru = name;
      }
      const labelsJson = serializeLabelsJson(labels);
      if (labelsJson) {
        data.labelsJson = labelsJson;
      }
    }
    for (const key of streamKeys) {
      data[key] = formData.get(`${key}:${st.id}`) === "1";
    }
    for (const key of colorKeys) {
      const color = String(formData.get(`${key}:${st.id}`) ?? "").trim();
      if (/^#[0-9a-fA-F]{6}$/.test(color)) {
        data[key] = color;
      }
    }
    await prisma.status.update({ where: { id: st.id }, data });
  }

  revalidatePath("/admin/statuses");
  revalidatePath("/inbound");
  revalidatePath("/outbound");
  revalidatePath("/", "layout");
}

export async function createStatus(formData: FormData) {
  await requireAdminWrite();

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  const name = String(formData.get("name") ?? "").trim();

  if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
    return throwLocalized("errors.admin.statusCodeInvalid");
  }
  if (!name) {
    return throwLocalized("errors.admin.statusNameRequired");
  }

  const existing = await prisma.status.findUnique({ where: { code } });
  if (existing) {
    return throwLocalized("errors.admin.statusCodeExists", { code });
  }

  const maxSort = await prisma.status.aggregate({ _max: { sortOrder: true } });

  await prisma.status.create({
    data: {
      code,
      name,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 10,
      isSystem: false,
      isActive: true,
      colorBg: "#f5f3ff",
      colorFg: "#5b21b6",
      colorBorder: "#c4b5fd",
    },
  });

  revalidatePath("/admin/statuses");
  revalidatePath("/", "layout");
}

/**
 * Очищает пользовательские данные: документы, остатки, НСИ, пользовательские разделы меню
 * и сущности конструктора (MetaEntity storage=custom).
 * Сохраняет: пользователей, роли, настройки склада, предопределённые единицы, типы ТН и модели учёта.
 */
export async function clearDatabaseSecure(formData: FormData) {
  await requireAdminWrite();
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== "ОЧИСТИТЬ" && confirm !== "CLEAR") {
    return throwLocalized("errors.admin.clearDbConfirm");
  }

  const {
    PREDEFINED_PALLET_TYPES,
    PREDEFINED_UNITS,
    PREDEFINED_ACCOUNTING_MODELS,
    ensurePredefinedCatalog,
  } = await import("@/lib/meta/seed-predefined");
  const predefinedUnitCodes = PREDEFINED_UNITS.map((u) => u.code);
  const predefinedPalletTypeCodes = PREDEFINED_PALLET_TYPES.map((t) => t.code);
  const predefinedAccountingCodes = PREDEFINED_ACCOUNTING_MODELS.map(
    (t) => t.code,
  );

  const {
    parseSidebarNavOrder,
    serializeSidebarNavOrder,
  } = await import("@/lib/nav/sidebar-menu");

  const settingsRow = await prisma.settings.findUnique({ where: { id: 1 } });
  const sidebarOrder = parseSidebarNavOrder(settingsRow?.sidebarNavOrder);
  const sidebarWithoutCustom = sidebarOrder?.filter((k) => !k.startsWith("nav:"));

  // Сброс ссылок на ячейки по умолчанию до удаления локаций
  await prisma.settings.update({
    where: { id: 1 },
    data: {
      defaultReceivingLocId: null,
      defaultShippingLocId: null,
      sidebarNavOrder:
        sidebarWithoutCustom && sidebarWithoutCustom.length > 0
          ? serializeSidebarNavOrder(sidebarWithoutCustom)
          : null,
    },
  });

  await prisma.$transaction([
    prisma.stockMovement.deleteMany(),
    prisma.inboundLine.deleteMany(),
    prisma.outboundLine.deleteMany(),
    prisma.inboundDocument.deleteMany(),
    prisma.outboundDocument.deleteMany(),
    prisma.stockBalance.deleteMany(),
    prisma.lot.deleteMany(),
    prisma.tsdTaskSession.deleteMany(),
    prisma.tsdDevice.deleteMany(),
    prisma.integrationOutbox.deleteMany(),
    prisma.integrationInbox.deleteMany(),
    prisma.metaValue.deleteMany(),
    prisma.metaRecord.deleteMany(),
    // Package → Product (без cascade) — сначала упаковки
    prisma.package.deleteMany(),
    prisma.product.deleteMany(),
    prisma.pallet.deleteMany(),
    prisma.location.deleteMany(),
    prisma.zone.deleteMany(),
    prisma.counterparty.deleteMany(),
    // Предопределённые типы ТН, единицы и модели учёта не трогаем
    prisma.accountingModel.deleteMany({
      where: { code: { notIn: [...predefinedAccountingCodes] } },
    }),
    prisma.palletType.deleteMany({
      where: { code: { notIn: [...predefinedPalletTypeCodes] } },
    }),
    prisma.unit.deleteMany({
      where: { code: { notIn: [...predefinedUnitCodes] } },
    }),
    // Пользовательские разделы меню и сущности конструктора
    prisma.metaEntity.deleteMany({ where: { storage: "custom" } }),
    prisma.navItem.deleteMany(),
    prisma.navIconOverride.deleteMany({
      where: { code: { startsWith: "nav:" } },
    }),
    prisma.rolePermission.deleteMany({
      where: {
        OR: [
          { code: { startsWith: "menu." } },
          { code: { startsWith: "nsi.catalog." } },
          { code: { startsWith: "nsi.document." } },
        ],
      },
    }),
  ]);

  const { seedSystemMeta } = await import("@/lib/meta/seed-system");
  const { ensurePutawayRuleSettings } = await import("@/lib/putaway/engine");
  await seedSystemMeta(prisma);
  await ensurePredefinedCatalog(prisma);
  await ensurePutawayRuleSettings();

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/nsi");
  revalidatePath("/catalog/units");
  revalidatePath("/catalog/cells");
  revalidatePath("/catalog/pallet_types");
  revalidatePath("/inbound");
  revalidatePath("/outbound");
  revalidatePath("/inventory");
  revalidatePath("/topology");
  revalidatePath("/admin/nav");
  revalidatePath("/admin/meta");
  revalidatePath("/admin/roles");
}
