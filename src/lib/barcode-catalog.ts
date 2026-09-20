import { prisma } from "@/lib/db";

export type BarcodeCatalogEntry = {
  id: string;
  kind: "product" | "location" | "pallet" | "package";
  kindLabel: string;
  title: string;
  code: string;
  catalogHref: string | null;
};

export async function listBarcodeCatalog(): Promise<BarcodeCatalogEntry[]> {
  const [products, locations, pallets, packages] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, name: true, barcode: true },
    }),
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, barcode: true },
    }),
    prisma.pallet.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, barcode: true },
    }),
    prisma.package.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        barcode: true,
        product: { select: { sku: true } },
      },
    }),
  ]);

  const entries: BarcodeCatalogEntry[] = [];

  for (const product of products) {
    const code = product.barcode?.trim() || product.sku.trim();
    if (!code) continue;
    entries.push({
      id: `product:${product.id}`,
      kind: "product",
      kindLabel: "Номенклатура",
      title: `${product.sku} · ${product.name}`,
      code,
      catalogHref: `/catalog/nomenclature/${product.id}`,
    });
  }

  for (const location of locations) {
    const code = location.barcode?.trim() || location.code.trim();
    if (!code) continue;
    entries.push({
      id: `location:${location.id}`,
      kind: "location",
      kindLabel: "Ячейка",
      title: location.name
        ? `${location.code} · ${location.name}`
        : location.code,
      code,
      catalogHref: `/catalog/cells/${location.id}`,
    });
  }

  for (const pallet of pallets) {
    const code = pallet.barcode?.trim() || pallet.code.trim();
    if (!code) continue;
    entries.push({
      id: `pallet:${pallet.id}`,
      kind: "pallet",
      kindLabel: "ТН",
      title: pallet.code,
      code,
      catalogHref: `/catalog/pallets/${pallet.id}`,
    });
  }

  for (const pkg of packages) {
    const code = pkg.barcode?.trim();
    if (!code) continue;
    entries.push({
      id: `package:${pkg.id}`,
      kind: "package",
      kindLabel: "Упаковка",
      title: `${pkg.product.sku} · ${pkg.name}`,
      code,
      catalogHref: `/catalog/packages/${pkg.id}`,
    });
  }

  return entries.sort((a, b) =>
    a.code.localeCompare(b.code, "ru", { sensitivity: "base" }),
  );
}
