"use server";

import { throwActionError } from "@/lib/i18n/locale-server";
import { throwLocalized } from "@/lib/i18n/errors-server";
import { prisma } from "@/lib/db";
import { ensureBasePackage } from "@/lib/meta/catalog";
import { formatReceivingDockLabel } from "@/lib/receiving-dock";
import { formatTransportUnitLabel } from "@/lib/transport-unit";
import { getModuleFlags } from "@/lib/session";
import { requirePermission } from "@/lib/permissions/check";
import type { PermissionCode } from "@/lib/permissions/registry";
import { calcManufacturedAt, parseOptionalDate } from "@/lib/stock";

export type QuickCreated = {
  id: string;
  label: string;
  productId?: string;
};

const QUICK_CREATE_WRITE: Record<string, PermissionCode> = {
  nomenclature: "nsi.nomenclature.write",
  counterparty: "nsi.counterparties.write",
  lot: "module.lots.write",
  cell: "nsi.cells.write",
  unit: "nsi.units.write",
  zone: "nsi.zones.write",
  receivingDock: "nsi.receiving_docks.write",
  transportUnit: "nsi.transport_units.write",
};

async function requireQuickCreateWrite(kind: string) {
  const code = QUICK_CREATE_WRITE[kind];
  if (!code) await throwActionError("unknownQuickCreateKind");
  await requirePermission(code);
}

export async function loadQuickCreateOptions(kind: string) {
  await requireQuickCreateWrite(kind);
  if (kind === "nomenclature") {
    const units = await prisma.unit.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return {
      units: units.map((u) => ({
        id: u.id,
        label: u.symbol ? `${u.name} (${u.symbol})` : u.name,
      })),
    };
  }
  if (kind === "lot") {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { sku: "asc" },
    });
    return {
      products: products.map((p) => ({
        id: p.id,
        label: `${p.sku} · ${p.name}`,
      })),
    };
  }
  if (kind === "cell" || kind === "receivingDock") {
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return {
      zones: zones.map((z) => ({
        id: z.id,
        label: `${z.name} · ${
          z.type === "RECEIVING"
            ? "Приёмка"
            : z.type === "SHIPPING"
              ? "Отгрузка"
              : z.type === "QUARANTINE"
                ? "Карантин"
                : "Хранение"
        }`,
      })),
    };
  }
  return {};
}

/** Полный список для выбора «Показать все». */
export async function loadQuickPickList(
  kind: string,
  filters?: {
    productId?: string;
    counterpartyKind?: "SUPPLIER" | "CUSTOMER" | "BOTH";
  },
): Promise<QuickCreated[]> {
  await requireQuickCreateWrite(kind);

  if (kind === "nomenclature") {
    const rows = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { sku: "asc" },
    });
    return rows.map((p) => ({ id: p.id, label: `${p.sku} · ${p.name}` }));
  }

  if (kind === "counterparty") {
    const kindFilter = filters?.counterpartyKind;
    const rows = await prisma.counterparty.findMany({
      where: {
        isActive: true,
        ...(kindFilter === "SUPPLIER"
          ? { OR: [{ kind: "SUPPLIER" }, { kind: "BOTH" }] }
          : kindFilter === "CUSTOMER"
            ? { OR: [{ kind: "CUSTOMER" }, { kind: "BOTH" }] }
            : {}),
      },
      orderBy: { name: "asc" },
    });
    return rows.map((r) => ({ id: r.id, label: r.name }));
  }

  if (kind === "lot") {
    const flags = await getModuleFlags();
    if (!flags.lots) return [];
    const rows = await prisma.lot.findMany({
      where: filters?.productId ? { productId: filters.productId } : undefined,
      orderBy: { number: "asc" },
      take: 500,
    });
    return rows.map((lot) => ({
      id: lot.id,
      label: lot.expiryDate
        ? `${lot.number} · до ${lot.expiryDate.toISOString().slice(0, 10)}`
        : lot.number,
      productId: lot.productId,
    }));
  }

  if (kind === "cell") {
    const rows = await prisma.location.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      take: 500,
    });
    return rows.map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` }));
  }

  if (kind === "receivingDock") {
    const rows = await prisma.receivingDock.findMany({
      where: { isActive: true },
      include: { zone: true },
      orderBy: { name: "asc" },
    });
    return rows.map((d) => ({ id: d.id, label: formatReceivingDockLabel(d) }));
  }

  if (kind === "transportUnit") {
    const rows = await prisma.transportUnit.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });
    return rows.map((u) => ({ id: u.id, label: formatTransportUnitLabel(u) }));
  }

  return [];
}

export async function quickCreateNomenclature(input: {
  sku: string;
  name: string;
  unitId: string;
  barcode?: string;
}): Promise<QuickCreated> {
  await requireQuickCreateWrite("nomenclature");
  const sku = input.sku.trim();
  const name = input.name.trim();
  const unitId = input.unitId.trim();
  if (!sku || !name || !unitId) {
    return throwLocalized("errors.quickCreate.skuNameUnitRequired");
  }

  const exists = await prisma.product.findUnique({ where: { sku } });
  if (exists) return throwLocalized("errors.quickCreate.skuExists");

  const product = await prisma.product.create({
    data: {
      sku,
      name,
      barcode: input.barcode?.trim() || null,
      unit: { connect: { id: unitId } },
    },
  });
  await ensureBasePackage(product.id, unitId, input.barcode?.trim() || null);
  return { id: product.id, label: `${product.sku} · ${product.name}` };
}

export async function quickCreateCounterparty(input: {
  name: string;
  kind?: "SUPPLIER" | "CUSTOMER" | "BOTH";
}): Promise<QuickCreated> {
  await requireQuickCreateWrite("counterparty");
  const name = input.name.trim();
  if (!name) return throwLocalized("errors.quickCreate.nameRequired");

  const row = await prisma.counterparty.create({
    data: {
      code: `CP-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
      name,
      kind: input.kind ?? "SUPPLIER",
    },
  });
  return { id: row.id, label: row.name };
}

export async function quickCreateLot(input: {
  productId: string;
  number: string;
  expiryDate?: string;
}): Promise<QuickCreated> {
  await requireQuickCreateWrite("lot");
  const flags = await getModuleFlags();
  if (!flags.lots) return throwLocalized("errors.quickCreate.lotsModuleDisabled");

  const productId = input.productId.trim();
  const number = input.number.trim();
  if (!productId || !number) {
    return throwLocalized("errors.quickCreate.productAndLotRequired");
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
  });
  if (!product) return throwLocalized("errors.quickCreate.productNotFound");

  const existing = await prisma.lot.findUnique({
    where: { productId_number: { productId, number } },
  });
  if (existing) return throwLocalized("errors.quickCreate.lotExists");

  const expiryDate = input.expiryDate
    ? parseOptionalDate(input.expiryDate)
    : null;

  const manufacturedAt = calcManufacturedAt(
    expiryDate,
    product.shelfLifeDays,
    product.shelfLifeUnit,
  );

  const lot = await prisma.lot.create({
    data: { productId, number, expiryDate, manufacturedAt },
  });
  return {
    id: lot.id,
    label: lot.expiryDate
      ? `${lot.number} · до ${lot.expiryDate.toISOString().slice(0, 10)}`
      : lot.number,
    productId: lot.productId,
  };
}

export async function quickCreateCell(input: {
  code: string;
  name: string;
  zoneId: string;
}): Promise<QuickCreated> {
  await requireQuickCreateWrite("cell");
  const code = input.code.trim();
  const name = input.name.trim();
  const zoneId = input.zoneId.trim();
  if (!code || !name) return throwLocalized("errors.quickCreate.codeNameRequired");
  if (!zoneId) return throwLocalized("errors.quickCreate.zoneRequired");

  const exists = await prisma.location.findUnique({ where: { code } });
  if (exists) return throwLocalized("errors.quickCreate.cellCodeExists");

  const zone = await prisma.zone.findFirst({
    where: { id: zoneId, isActive: true },
  });
  if (!zone) return throwLocalized("errors.quickCreate.zoneNotFound");

  const cell = await prisma.location.create({
    data: {
      code,
      name,
      type: zone.type,
      zoneId,
      barcode: code,
    },
  });
  return { id: cell.id, label: `${cell.code} · ${cell.name}` };
}

export async function quickCreateUnit(input: {
  name: string;
  symbol?: string;
}): Promise<QuickCreated> {
  await requireQuickCreateWrite("unit");
  const name = input.name.trim();
  if (!name) return throwLocalized("errors.quickCreate.nameRequired");

  const unit = await prisma.unit.create({
    data: {
      code: `U-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
      name,
      symbol: input.symbol?.trim() || null,
    },
  });
  return {
    id: unit.id,
    label: unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name,
  };
}

export async function quickCreateZone(input: {
  name: string;
  type?: string;
}): Promise<QuickCreated> {
  await requireQuickCreateWrite("zone");
  const name = input.name.trim();
  if (!name) return throwLocalized("errors.quickCreate.nameRequired");

  const typeRaw = (input.type || "STORAGE").trim();
  const type = (
    ["RECEIVING", "STORAGE", "SHIPPING", "QUARANTINE"].includes(typeRaw)
      ? typeRaw
      : "STORAGE"
  ) as "RECEIVING" | "STORAGE" | "SHIPPING" | "QUARANTINE";

  const zone = await prisma.zone.create({
    data: {
      code: `ZN-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
      name,
      type,
      color: "#0b6e4f",
    },
  });
  return { id: zone.id, label: zone.name };
}

export async function quickCreateReceivingDock(input: {
  name: string;
  zoneId?: string;
  notes?: string;
}): Promise<QuickCreated> {
  await requireQuickCreateWrite("receivingDock");
  const name = input.name.trim();
  if (!name) return throwLocalized("errors.quickCreate.dockNameRequired");

  const zoneId = input.zoneId?.trim() || null;
  if (zoneId) {
    const zone = await prisma.zone.findFirst({
      where: { id: zoneId, isActive: true },
    });
    if (!zone) return throwLocalized("errors.quickCreate.zoneNotFound");
  }

  const code = `RD-${String((await prisma.receivingDock.count()) + 1).padStart(3, "0")}`;
  const dock = await prisma.receivingDock.create({
    data: {
      code,
      name,
      zoneId,
      notes: input.notes?.trim() || null,
    },
    include: { zone: true },
  });
  return { id: dock.id, label: formatReceivingDockLabel(dock) };
}

export async function quickCreateTransportUnit(input: {
  plateNumber: string;
  driverName: string;
  driverPhone?: string;
  driverLicense?: string;
  passport?: string;
  carrierName?: string;
  notes?: string;
}): Promise<QuickCreated> {
  await requireQuickCreateWrite("transportUnit");
  const plateNumber = input.plateNumber.trim();
  const driverName = input.driverName.trim();
  if (!plateNumber || !driverName) {
    return throwLocalized("errors.quickCreate.transportPlateAndDriverRequired");
  }

  const code = `TR-${String((await prisma.transportUnit.count()) + 1).padStart(3, "0")}`;
  const unit = await prisma.transportUnit.create({
    data: {
      code,
      plateNumber,
      driverName,
      carrierName: input.carrierName?.trim() || null,
      driverPhone: input.driverPhone?.trim() || null,
      driverLicense: input.driverLicense?.trim() || null,
      passport: input.passport?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
  return { id: unit.id, label: formatTransportUnitLabel(unit) };
}
