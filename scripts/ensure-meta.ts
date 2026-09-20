import "dotenv/config";
import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedSystemMeta } from "../src/lib/meta/seed-system";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const resolved = url.startsWith("file:")
  ? `file:${path.resolve(process.cwd(), url.replace(/^file:/, ""))}`
  : url;

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: resolved }),
});

async function main() {
  const before = await prisma.metaEntity.count();
  console.log("meta entities before:", before);
  if (before === 0) {
    await seedSystemMeta(prisma);
    console.log("seeded system meta");
  }
  const after = await prisma.metaEntity.findMany({
    select: { code: true },
    orderBy: { code: "asc" },
  });
  console.log(
    "meta entities after:",
    after.length,
    after.map((e) => e.code).join(", "),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
