import "dotenv/config";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const resolved = url.startsWith("file:")
  ? `file:${path.resolve(process.cwd(), url.replace(/^file:/, ""))}`
  : url;

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: resolved }),
});

async function main() {
  const login = (process.env.ADMIN_LOGIN ?? "admin").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  const hash = await bcrypt.hash(password, 10);

  const role = await prisma.role.upsert({
    where: { code: "admin" },
    create: { code: "admin", name: "Администратор" },
    update: {},
  });

  const legacy = await prisma.user.findUnique({
    where: { email: "admin@wms.local" },
  });

  let userId: string;

  if (legacy) {
    const clash = await prisma.user.findUnique({ where: { email: login } });
    if (clash && clash.id !== legacy.id) {
      await prisma.userRole.deleteMany({ where: { userId: clash.id } });
      await prisma.user.delete({ where: { id: clash.id } });
    }
    const updated = await prisma.user.update({
      where: { id: legacy.id },
      data: {
        email: login,
        passwordHash: hash,
        isActive: true,
        name: "Администратор",
      },
    });
    userId = updated.id;
    console.log("Migrated legacy admin to login:", login);
  } else {
    const user = await prisma.user.upsert({
      where: { email: login },
      create: {
        email: login,
        name: "Администратор",
        passwordHash: hash,
        roles: { create: [{ roleId: role.id }] },
      },
      update: {
        passwordHash: hash,
        isActive: true,
        name: "Администратор",
      },
    });
    userId = user.id;
    console.log("Upserted admin login:", login);
  }

  const link = await prisma.userRole.findUnique({
    where: { userId_roleId: { userId, roleId: role.id } },
  });
  if (!link) {
    await prisma.userRole.create({ data: { userId, roleId: role.id } });
  }

  const stored = await prisma.user.findUniqueOrThrow({ where: { email: login } });
  const ok = await bcrypt.compare(password, stored.passwordHash);
  console.log("Password verify:", ok ? "ok" : "FAIL");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
