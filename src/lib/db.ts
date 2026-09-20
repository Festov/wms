import "dotenv/config";
import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaRev?: number;
};

/** Bump when Prisma schema changes so HMR does not keep a stale client. */
const SCHEMA_REV = 30;

function resolveDbUrl(url: string) {
  if (!url.startsWith("file:")) return url;
  const filePath = url.replace(/^file:/, "");
  if (path.isAbsolute(filePath)) return `file:${filePath}`;
  const relative = filePath.replace(/^\.\//, "");
  if (relative.startsWith("prisma/")) {
    return `file:${path.join(/* turbopackIgnore: true */ process.cwd(), relative)}`;
  }
  return `file:${path.join(/* turbopackIgnore: true */ process.cwd(), "prisma", relative)}`;
}

function isPostgresUrl(url: string) {
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

  if (isPostgresUrl(url)) {
    const pool = new Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }

  const resolved = resolveDbUrl(url);
  const adapter = new PrismaLibSql({ url: resolved });
  return new PrismaClient({ adapter });
}

function isStaleClient(client: PrismaClient | undefined) {
  if (!client) return true;
  if (globalForPrisma.prismaSchemaRev !== SCHEMA_REV) return true;
  const c = client as unknown as Record<string, unknown>;
  if (
    typeof c.putawayRuleSetting !== "object" ||
    typeof c.tsdTaskSession !== "object" ||
    typeof c.accountingModel !== "object" ||
    typeof c.rolePermission !== "object" ||
    typeof c.status !== "object" ||
    typeof c.operationDocument !== "object" ||
    typeof c.appSetting !== "object" ||
    typeof c.receivingDock !== "object" ||
    typeof c.transportUnit !== "object" ||
    typeof c.outboundStatusHistory !== "object" ||
    typeof c.metaAttribute !== "object"
  ) {
    return true;
  }
  return false;
}

export const prisma = isStaleClient(globalForPrisma.prisma)
  ? createPrismaClient()
  : globalForPrisma.prisma!;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaRev = SCHEMA_REV;
}
