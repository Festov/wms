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
  const login = "admin";
  const password = "admin123";
  const user = await prisma.user.findUnique({
    where: { email: login },
    include: { roles: { include: { role: true } } },
  });
  if (!user) {
    console.log("NO_USER");
    return;
  }
  console.log({
    found: true,
    email: user.email,
    active: user.isActive,
    roles: user.roles.map((r) => r.role.code),
    passwordOk: await bcrypt.compare(password, user.passwordHash),
  });
}

main().finally(() => prisma.$disconnect());
