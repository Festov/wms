import "dotenv/config";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedSystemMeta } from "../src/lib/meta/seed-system";
import { randomPassword, randomSecret } from "../src/lib/security/random";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const resolved = url.startsWith("file:")
  ? `file:${path.resolve(process.cwd(), url.replace(/^file:/, ""))}`
  : url;

const adapter = new PrismaLibSql({ url: resolved });
const prisma = new PrismaClient({ adapter });

const ROLES = [
  { code: "admin", name: "Администратор", description: "Полный доступ" },
  {
    code: "operator",
    name: "Оператор",
    description: "Складские операции без админки",
  },
  { code: "viewer", name: "Просмотр", description: "Только чтение" },
];

async function main() {
  await prisma.metaValue.deleteMany();
  await prisma.metaRecord.deleteMany();
  await prisma.metaAttribute.deleteMany();
  await prisma.metaFormSection.deleteMany();
  await prisma.metaEntity.deleteMany();
  await prisma.integrationOutbox.deleteMany();
  await prisma.integrationInbox.deleteMany();
  await prisma.tsdDevice.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.navIconOverride.deleteMany();
  await prisma.integrationEndpoint.deleteMany();
  await prisma.integrationApiKey.deleteMany();

  await prisma.stockMovement.deleteMany();
  await prisma.inboundLine.deleteMany();
  await prisma.outboundLine.deleteMany();
  await prisma.inboundDocument.deleteMany();
  await prisma.outboundDocument.deleteMany();
  await prisma.stockBalance.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.product.deleteMany();
  await prisma.package.deleteMany();
  await prisma.pallet.deleteMany();
  await prisma.location.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.palletType.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.counterparty.deleteMany();

  const tsdApiKey = process.env.TSD_API_KEY?.trim() || `tsd_${randomSecret()}`;

  await prisma.settings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      warehouseName: "Склад",
      warehouseCode: "WH-01",
      tsdApiKey,
      moduleInbound: true,
      moduleOutbound: true,
      moduleTopology: true,
      moduleLots: true,
      moduleMenus: true,
      moduleOperations: true,
      moduleTsd: true,
    },
    update: {
      warehouseName: "Склад",
      warehouseCode: "WH-01",
      tsdApiKey,
      moduleInbound: true,
      moduleOutbound: true,
      moduleTopology: true,
      moduleLots: true,
      moduleMenus: true,
      moduleOperations: true,
      moduleTsd: true,
    },
  });

  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      create: { ...role, isSystem: true },
      update: { name: role.name, description: role.description, isSystem: true },
    });
  }

  const adminLogin = (process.env.ADMIN_LOGIN ?? "admin").toLowerCase();
  const isProd = process.env.NODE_ENV === "production";
  const adminPassword =
    process.env.ADMIN_PASSWORD?.trim() ||
    (isProd ? randomPassword(20) : "admin123");
  if (isProd && !process.env.ADMIN_PASSWORD?.trim()) {
    console.warn(
      "[seed] ADMIN_PASSWORD not set — generated a random password for production seed.",
    );
  }
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { code: "admin" },
  });

  // Rename legacy email-login if needed
  const legacy = await prisma.user.findUnique({
    where: { email: "admin@wms.local" },
  });
  if (legacy) {
    const clash = await prisma.user.findUnique({ where: { email: adminLogin } });
    if (!clash) {
      await prisma.user.update({
        where: { id: legacy.id },
        data: { email: adminLogin, passwordHash, isActive: true, name: "Администратор" },
      });
    } else if (clash.id !== legacy.id) {
      await prisma.userRole.deleteMany({ where: { userId: legacy.id } });
      await prisma.user.delete({ where: { id: legacy.id } });
    }
  }

  const admin = await prisma.user.upsert({
    where: { email: adminLogin },
    create: {
      email: adminLogin,
      name: "Администратор",
      passwordHash,
      roles: { create: [{ roleId: adminRole.id }] },
    },
    update: {
      name: "Администратор",
      passwordHash,
      isActive: true,
    },
  });

  const existing = await prisma.userRole.findUnique({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
  });
  if (!existing) {
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: adminRole.id },
    });
  }

  await seedSystemMeta(prisma);

  const { ensurePredefinedCatalog } = await import(
    "../src/lib/meta/seed-predefined"
  );
  await ensurePredefinedCatalog(prisma);

  const { ensurePutawayRuleSettings } = await import(
    "../src/lib/putaway/engine"
  );
  await ensurePutawayRuleSettings();

  const { ensureRolePermissions } = await import(
    "../src/lib/permissions/check"
  );
  // Force rebuild of RolePermission after roles were recreated.
  await prisma.appSetting.deleteMany({ where: { key: "permissionsSeedRev" } });
  await ensureRolePermissions();

  if (process.env.SEED_DEMO_USERS === "1") {
    const demoPassword =
      process.env.SEED_DEMO_PASSWORD?.trim() ||
      (isProd ? randomPassword(20) : "demo123");
    const demoHash = await bcrypt.hash(demoPassword, 10);
    for (const code of ["operator", "viewer"] as const) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code } });
      const login = code;
      const user = await prisma.user.upsert({
        where: { email: login },
        create: {
          email: login,
          name: code === "operator" ? "Оператор" : "Просмотр",
          passwordHash: demoHash,
          isActive: true,
          roles: { create: [{ roleId: role.id }] },
        },
        update: {
          passwordHash: demoHash,
          isActive: true,
          name: code === "operator" ? "Оператор" : "Просмотр",
        },
      });
      const link = await prisma.userRole.findUnique({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
      });
      if (!link) {
        await prisma.userRole.create({
          data: { userId: user.id, roleId: role.id },
        });
      }
    }
    if (!isProd) {
      console.log(
        `Demo users: operator / ${demoPassword}, viewer / ${demoPassword}`,
      );
    }
  }

  const { ensureStatuses } = await import("../src/lib/status/seed");
  await ensureStatuses(prisma);

  const { ensureAppSettingsDefaults } = await import(
    "../src/lib/settings/storage"
  );
  await ensureAppSettingsDefaults();

  await prisma.integrationEndpoint.upsert({
    where: { code: "default_webhook" },
    create: {
      code: "default_webhook",
      name: "Default webhook",
      type: "webhook",
      url: process.env.INTEGRATION_WEBHOOK_URL ?? null,
      isActive: Boolean(process.env.INTEGRATION_WEBHOOK_URL),
    },
    update: {},
  });

  await prisma.integrationEndpoint.upsert({
    where: { code: "default_1c" },
    create: {
      code: "default_1c",
      name: "1C adapter",
      type: "1c",
      url: process.env.INTEGRATION_1C_URL ?? null,
      isActive: Boolean(process.env.INTEGRATION_1C_URL),
    },
    update: {},
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(`Seed OK. Admin login: ${adminLogin} / ${adminPassword}`);
    console.log(`TSD API key: ${tsdApiKey}`);
  } else {
    console.log(`Seed OK. Admin login: ${adminLogin}`);
    console.log("TSD API key written to Settings (not logged in production).");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
