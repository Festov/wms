import { prisma } from "@/lib/db";
import {
  menuCatalogViewPermission,
  menuCatalogWritePermission,
  menuDocumentViewPermission,
  menuDocumentWritePermission,
  navSlugFromCode,
  navViewPermission,
  nsiCatalogViewPermission,
  nsiCatalogWritePermission,
  nsiDocumentViewPermission,
  nsiDocumentWritePermission,
  type CustomUiPermissionContext,
} from "@/lib/menu/permissions";

export type { CustomUiPermissionContext };

type CustomEntityRow = {
  code: string;
  name: string;
  pluralName: string | null;
  navItemCode: string | null;
  kind: string;
};

function splitCustomEntities(rows: CustomEntityRow[]) {
  const menuCatalogs: CustomUiPermissionContext["menuCatalogs"] = [];
  const nsiCatalogs: CustomUiPermissionContext["nsiCatalogs"] = [];
  const menuDocuments: CustomUiPermissionContext["menuDocuments"] = [];
  const nsiDocuments: CustomUiPermissionContext["nsiDocuments"] = [];

  for (const row of rows) {
    const base = {
      code: row.code,
      name: row.name,
      pluralName: row.pluralName,
    };
    if (row.kind === "catalog") {
      if (row.navItemCode) {
        menuCatalogs.push({ ...base, navItemCode: row.navItemCode });
      } else {
        nsiCatalogs.push(base);
      }
      continue;
    }
    if (row.kind === "document") {
      if (row.navItemCode) {
        menuDocuments.push({ ...base, navItemCode: row.navItemCode });
      } else {
        nsiDocuments.push(base);
      }
    }
  }

  return { menuCatalogs, nsiCatalogs, menuDocuments, nsiDocuments };
}

export async function loadCustomUiPermissionContext(): Promise<CustomUiPermissionContext> {
  const [navItems, entities] = await Promise.all([
    prisma.navItem.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { code: true, label: true },
    }),
    prisma.metaEntity.findMany({
      where: { storage: "custom", isActive: true, kind: { in: ["catalog", "document"] } },
      orderBy: { name: "asc" },
      select: {
        code: true,
        name: true,
        pluralName: true,
        navItemCode: true,
        kind: true,
      },
    }),
  ]);

  const { menuCatalogs, nsiCatalogs, menuDocuments, nsiDocuments } =
    splitCustomEntities(entities);

  return { navItems, menuCatalogs, nsiCatalogs, menuDocuments, nsiDocuments };
}

export async function collectDynamicPermissionCodes(): Promise<string[]> {
  const ctx = await loadCustomUiPermissionContext();
  const codes = new Set<string>();

  for (const item of ctx.navItems) {
    codes.add(navViewPermission(navSlugFromCode(item.code)));
  }
  for (const catalog of ctx.menuCatalogs) {
    codes.add(menuCatalogViewPermission(catalog.code));
    codes.add(menuCatalogWritePermission(catalog.code));
  }
  for (const catalog of ctx.nsiCatalogs) {
    codes.add(nsiCatalogViewPermission(catalog.code));
    codes.add(nsiCatalogWritePermission(catalog.code));
  }
  for (const document of ctx.menuDocuments) {
    codes.add(menuDocumentViewPermission(document.code));
    codes.add(menuDocumentWritePermission(document.code));
  }
  for (const document of ctx.nsiDocuments) {
    codes.add(nsiDocumentViewPermission(document.code));
    codes.add(nsiDocumentWritePermission(document.code));
  }

  return [...codes];
}
