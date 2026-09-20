import "dotenv/config";
import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { ensurePutawayRuleSettings } from "../src/lib/putaway/engine";
import { seedSystemMeta } from "../src/lib/meta/seed-system";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const resolved = url.startsWith("file:")
  ? `file:${path.resolve(process.cwd(), url.replace(/^file:/, ""))}`
  : url;
const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: resolved }),
});

async function main() {
  await ensurePutawayRuleSettings();
  await seedSystemMeta(prisma);
  console.log("putaway rules:", await prisma.putawayRuleSetting.count());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
