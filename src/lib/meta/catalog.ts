import { prisma } from "@/lib/db";

async function locThrow(
  key: string,
  values?: Record<string, string | number>,
): Promise<never> {
  const { throwLocalized } = await import("@/lib/i18n/errors-server");
  return throwLocalized(key, values);
}

import type { Prisma } from "@/generated/prisma/client";
import {
  getCachedMetaEntity,
  setCachedMetaEntity,
  getCachedMetaEntityList,
  setCachedMetaEntityList,
} from "@/lib/meta/cache";
import {
  ensurePredefinedCatalog,
  isPredefinedPalletTypeCode,
} from "@/lib/meta/seed-predefined";

export { invalidateMetaEntityCache } from "@/lib/meta/cache";
import { flagsFromAccountingModel } from "@/lib/accounting-model";
import { enumLabel } from "@/lib/format";
import {
  allocatePalletCodes,
  normalizePalletBarcodeTemplate,
} from "@/lib/pallet-code";

/** Название упаковки: коэффициент и единица в скобках, напр. «×10 (шт)». */
export function packageDisplayName(
  factor: number,
  unit: { symbol: string | null; name: string },
) {
  const unitLabel = (unit.symbol || unit.name).trim() || "ед.";
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return `×${f} (${unitLabel})`;
}

async function allocatePackageCode(
  productSku: string,
  factor: number,
  unitLabel: string,
  excludeId?: string,
) {
  const base = `PKG-${productSku}-x${factor}-${unitLabel}`
    .replace(/\s+/g, "")
    .slice(0, 48);
  let code = base;
  let n = 2;
  for (;;) {
    const existing = await prisma.package.findUnique({ where: { code } });
    if (!existing || existing.id === excludeId) return code;
    code = `${base}-${n}`.slice(0, 64);
    n += 1;
  }
}

function optionalFloat(value: unknown) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function packageDimsFromData(data: Record<string, unknown>) {
  return {
    lengthMm: optionalFloat(data.lengthMm),
    widthMm: optionalFloat(data.widthMm),
    heightMm: optionalFloat(data.heightMm),
    weightGrossKg: optionalFloat(data.weightGrossKg),
  };
}

async function resolvePackageIdentity(
  data: Record<string, unknown>,
  excludeId?: string,
) {
  const productId = String(data.productId ?? "").trim();
  const unitId = String(data.unitId ?? "").trim();
  const factor = Number(data.factor ?? 1);
  if (!productId) return locThrow("errors.catalog.productRequired");
  if (!unitId) return locThrow("errors.catalog.unitRequired");
  if (!Number.isFinite(factor) || factor <= 0) {
    return locThrow("errors.catalog.factorPositive");
  }

  const [product, unit] = await Promise.all([
    prisma.product.findUniqueOrThrow({ where: { id: productId } }),
    prisma.unit.findUniqueOrThrow({ where: { id: unitId } }),
  ]);

  const name = packageDisplayName(factor, unit);
  const unitLabel = (unit.symbol || unit.name).trim() || "u";
  const code = await allocatePackageCode(product.sku, factor, unitLabel, excludeId);
  const barcode = String(data.barcode ?? "").trim() || null;

  return { productId, unitId, factor, name, code, barcode };
}

/** Создать упаковку или вернуть уже существующую с тем же product/unit/factor. */
export async function findOrCreatePackage(input: {
  productId: string;
  unitId: string;
  factor: number;
  barcode?: string | null;
}) {
  const factor = Number(input.factor);
  if (!Number.isFinite(factor) || factor <= 0) {
    return locThrow("errors.catalog.factorPositive");
  }

  const existing = await prisma.package.findFirst({
    where: {
      productId: input.productId,
      unitId: input.unitId,
      factor,
      isActive: true,
    },
    include: { unit: true },
  });
  if (existing) {
    if (input.barcode && !existing.barcode) {
      return prisma.package.update({
        where: { id: existing.id },
        data: { barcode: input.barcode },
        include: { unit: true },
      });
    }
    return existing;
  }

  const identity = await resolvePackageIdentity({
    productId: input.productId,
    unitId: input.unitId,
    factor,
    barcode: input.barcode ?? null,
  });
  return prisma.package.create({
    data: {
      code: identity.code,
      name: identity.name,
      productId: identity.productId,
      unitId: identity.unitId,
      factor: identity.factor,
      barcode: identity.barcode,
    },
    include: { unit: true },
  });
}

/** Base package x1 for the product unit (created with nomenclature). */
export async function ensureBasePackage(
  productId: string,
  unitId: string,
  barcode?: string | null,
) {
  const existing = await prisma.package.findFirst({
    where: { productId, unitId, factor: 1, isActive: true },
  });
  if (existing) {
    if (barcode && !existing.barcode) {
      return prisma.package.update({
        where: { id: existing.id },
        data: { barcode },
      });
    }
    return existing;
  }

  const identity = await resolvePackageIdentity({
    productId,
    unitId,
    factor: 1,
    barcode: barcode ?? null,
  });
  return prisma.package.create({
    data: {
      code: identity.code,
      name: identity.name,
      productId: identity.productId,
      unitId: identity.unitId,
      factor: 1,
      barcode: identity.barcode,
    },
  });
}

type LocationTypeValue = "RECEIVING" | "STORAGE" | "SHIPPING" | "QUARANTINE";

function parseLocationType(value: unknown): LocationTypeValue {
  const raw = String(value ?? "STORAGE");
  if (
    raw === "RECEIVING" ||
    raw === "STORAGE" ||
    raw === "SHIPPING" ||
    raw === "QUARANTINE"
  ) {
    return raw;
  }
  return "STORAGE";
}

async function locationTypeFromZone(zoneId: string | null | undefined) {
  if (!zoneId) return "STORAGE" as const;
  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  return (zone?.type ?? "STORAGE") as LocationTypeValue;
}

export type MetaEntityFull = Prisma.MetaEntityGetPayload<{
  include: {
    attributes: { include: { section: true } };
    sections: true;
  };
}>;

function applyEntityUiFilters(entity: MetaEntityFull): MetaEntityFull {
  if (entity.code === "zones") {
    return {
      ...entity,
      attributes: entity.attributes.filter(
        (a) => a.code !== "color" && a.code !== "code",
      ),
    };
  }
  if (entity.code === "counterparties") {
    return {
      ...entity,
      attributes: entity.attributes.filter((a) => a.code !== "code"),
    };
  }
  if (entity.code === "receiving_docks" || entity.code === "transport_units") {
    return {
      ...entity,
      attributes: entity.attributes.filter((a) => a.code !== "code"),
    };
  }
  if (entity.code === "units") {
    return {
      ...entity,
      attributes: entity.attributes.filter((a) => a.code !== "code"),
    };
  }
  if (entity.code === "accounting_models") {
    return {
      ...entity,
      attributes: entity.attributes.filter((a) => a.code !== "code"),
    };
  }
  return entity;
}

export async function getMetaEntity(code: string): Promise<MetaEntityFull | null> {
  const cached = getCachedMetaEntity(code);
  if (cached) return cached;

  const include = {
    sections: { orderBy: { order: "asc" as const } },
    attributes: {
      orderBy: { order: "asc" as const },
      include: { section: true },
    },
  };

  const entity = await prisma.metaEntity.findUnique({
    where: { code },
    include,
  });

  if (!entity) return null;

  const filtered = applyEntityUiFilters(entity);
  setCachedMetaEntity(code, filtered);
  return filtered;
}

export async function listMetaEntities() {
  const cached = getCachedMetaEntityList();
  if (cached) return cached;

  const list = await prisma.metaEntity.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { attributes: true, records: true } } },
  });
  setCachedMetaEntityList(list);
  return list;
}

type Row = Record<string, unknown> & { id: string };

const SYSTEM_HANDLERS: Record<
  string,
  {
    list: () => Promise<Row[]>;
    get: (id: string) => Promise<Row | null>;
    create: (data: Record<string, unknown>) => Promise<Row>;
    update: (id: string, data: Record<string, unknown>) => Promise<Row>;
  }
> = {
  units: {
    list: async () => prisma.unit.findMany({ orderBy: { name: "asc" } }),
    get: async (id) => prisma.unit.findUnique({ where: { id } }),
    create: async (data) =>
      prisma.unit.create({
        data: {
          code: `U-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
          name: String(data.name ?? ""),
          symbol: data.symbol ? String(data.symbol) : null,
        },
      }),
    update: async (id, data) =>
      prisma.unit.update({
        where: { id },
        data: {
          name: String(data.name ?? ""),
          symbol: data.symbol ? String(data.symbol) : null,
        },
      }),
  },
  zones: {
    list: async () => prisma.zone.findMany({ orderBy: { name: "asc" } }),
    get: async (id) => prisma.zone.findUnique({ where: { id } }),
    create: async (data) =>
      prisma.zone.create({
        data: {
          code: `ZN-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
          name: String(data.name ?? ""),
          type: parseLocationType(data.type),
          color: String(data.color ?? "#0b6e4f"),
          notes: data.notes ? String(data.notes) : null,
        },
      }),
    update: async (id, data) => {
      const existing = await prisma.zone.findUniqueOrThrow({ where: { id } });
      const type = parseLocationType(data.type);
      const zone = await prisma.zone.update({
        where: { id },
        data: {
          code: existing.code,
          name: String(data.name ?? ""),
          type,
          color: String(data.color ?? existing.color ?? "#0b6e4f"),
          notes: data.notes ? String(data.notes) : null,
        },
      });
      // Ячейки зоны наследуют тип хранения
      await prisma.location.updateMany({
        where: { zoneId: id },
        data: { type },
      });
      return zone;
    },
  },
  counterparties: {
    list: async () => prisma.counterparty.findMany({ orderBy: { name: "asc" } }),
    get: async (id) => prisma.counterparty.findUnique({ where: { id } }),
    create: async (data) =>
      prisma.counterparty.create({
        data: {
          code: `CP-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
          name: String(data.name ?? ""),
          kind: (String(data.kind ?? "BOTH") as "SUPPLIER" | "CUSTOMER" | "BOTH"),
          inn: data.inn ? String(data.inn) : null,
          phone: data.phone ? String(data.phone) : null,
          email: data.email ? String(data.email) : null,
        },
      }),
    update: async (id, data) =>
      prisma.counterparty.update({
        where: { id },
        data: {
          name: String(data.name ?? ""),
          kind: (String(data.kind ?? "BOTH") as "SUPPLIER" | "CUSTOMER" | "BOTH"),
          inn: data.inn ? String(data.inn) : null,
          phone: data.phone ? String(data.phone) : null,
          email: data.email ? String(data.email) : null,
        },
      }),
  },
  receiving_docks: {
    list: async () =>
      prisma.receivingDock.findMany({
        orderBy: { name: "asc" },
        include: { zone: true },
      }),
    get: async (id) =>
      prisma.receivingDock.findUnique({
        where: { id },
        include: { zone: true },
      }),
    create: async (data) => {
      const name = String(data.name ?? "").trim();
      if (!name) return locThrow("errors.catalog.dockNameRequired");
      const zoneId = data.zoneId ? String(data.zoneId) : null;
      if (zoneId) {
        const zone = await prisma.zone.findFirst({
          where: { id: zoneId, isActive: true },
        });
        if (!zone) return locThrow("errors.catalog.zoneNotFound");
      }
      const code = `RD-${String((await prisma.receivingDock.count()) + 1).padStart(3, "0")}`;
      return prisma.receivingDock.create({
        data: {
          code,
          name,
          zoneId,
          notes: data.notes ? String(data.notes) : null,
          isActive: data.isActive !== false,
        },
        include: { zone: true },
      });
    },
    update: async (id, data) => {
      const name = String(data.name ?? "").trim();
      if (!name) return locThrow("errors.catalog.dockNameRequired");
      const zoneId = data.zoneId ? String(data.zoneId) : null;
      if (zoneId) {
        const zone = await prisma.zone.findFirst({
          where: { id: zoneId, isActive: true },
        });
        if (!zone) return locThrow("errors.catalog.zoneNotFound");
      }
      const status = data.status;
      const dockStatus =
        status === "BUSY" || status === "FREE" ? status : undefined;
      return prisma.receivingDock.update({
        where: { id },
        data: {
          name,
          zoneId,
          notes: data.notes ? String(data.notes) : null,
          isActive: Boolean(data.isActive),
          ...(dockStatus ? { status: dockStatus } : {}),
        },
        include: { zone: true },
      });
    },
  },
  transport_units: {
    list: async () =>
      prisma.transportUnit.findMany({ orderBy: { plateNumber: "asc" } }),
    get: async (id) => prisma.transportUnit.findUnique({ where: { id } }),
    create: async (data) => {
      const plateNumber = String(data.plateNumber ?? "").trim();
      const driverName = String(data.driverName ?? "").trim();
      if (!plateNumber || !driverName) {
        return locThrow("errors.catalog.transportPlateAndDriverRequired");
      }
      const code = `TR-${String((await prisma.transportUnit.count()) + 1).padStart(3, "0")}`;
      return prisma.transportUnit.create({
        data: {
          code,
          plateNumber,
          driverName,
          carrierName: data.carrierName ? String(data.carrierName) : null,
          driverPhone: data.driverPhone ? String(data.driverPhone) : null,
          driverLicense: data.driverLicense ? String(data.driverLicense) : null,
          passport: data.passport ? String(data.passport) : null,
          notes: data.notes ? String(data.notes) : null,
          isActive: data.isActive !== false,
        },
      });
    },
    update: async (id, data) => {
      const plateNumber = String(data.plateNumber ?? "").trim();
      const driverName = String(data.driverName ?? "").trim();
      if (!plateNumber || !driverName) {
        return locThrow("errors.catalog.transportPlateAndDriverRequired");
      }
      return prisma.transportUnit.update({
        where: { id },
        data: {
          plateNumber,
          driverName,
          carrierName: data.carrierName ? String(data.carrierName) : null,
          driverPhone: data.driverPhone ? String(data.driverPhone) : null,
          driverLicense: data.driverLicense ? String(data.driverLicense) : null,
          passport: data.passport ? String(data.passport) : null,
          notes: data.notes ? String(data.notes) : null,
          isActive: Boolean(data.isActive),
        },
      });
    },
  },
  packages: {
    list: async () =>
      prisma.package.findMany({
        orderBy: { code: "asc" },
        include: { unit: true, product: true },
      }),
    get: async (id) =>
      prisma.package.findUnique({
        where: { id },
        include: { unit: true, product: true },
      }),
    create: async (data) => {
      const identity = await resolvePackageIdentity(data);
      const dims = packageDimsFromData(data);
      return prisma.package.create({
        data: {
          code: identity.code,
          name: identity.name,
          productId: identity.productId,
          unitId: identity.unitId,
          factor: identity.factor,
          barcode: identity.barcode,
          ...dims,
        },
      });
    },
    update: async (id, data) => {
      const identity = await resolvePackageIdentity(data, id);
      const dims = packageDimsFromData(data);
      return prisma.package.update({
        where: { id },
        data: {
          code: identity.code,
          name: identity.name,
          productId: identity.productId,
          unitId: identity.unitId,
          factor: identity.factor,
          barcode: identity.barcode,
          ...dims,
        },
      });
    },
  },
  pallet_types: {
    list: async () => prisma.palletType.findMany({ orderBy: { code: "asc" } }),
    get: async (id) => prisma.palletType.findUnique({ where: { id } }),
    create: async (data) =>
      prisma.palletType.create({
        data: {
          code: String(data.code ?? ""),
          name: String(data.name ?? ""),
          barcodeTemplate: data.barcodeTemplate
            ? normalizePalletBarcodeTemplate(String(data.barcodeTemplate))
            : null,
          lengthMm: data.lengthMm ? Number(data.lengthMm) : null,
          widthMm: data.widthMm ? Number(data.widthMm) : null,
          heightMm: data.heightMm ? Number(data.heightMm) : null,
          weightOwnKg: data.weightOwnKg ? Number(data.weightOwnKg) : null,
          maxWeightKg: data.maxWeightKg ? Number(data.maxWeightKg) : null,
        },
      }),
    update: async (id, data) => {
      const existing = await prisma.palletType.findUniqueOrThrow({
        where: { id },
      });
      const predefined = isPredefinedPalletTypeCode(existing.code);
      return prisma.palletType.update({
        where: { id },
        data: {
          // Код предопределённого типа не меняем
          code: predefined ? existing.code : String(data.code ?? existing.code),
          name: String(data.name ?? ""),
          barcodeTemplate: data.barcodeTemplate
            ? normalizePalletBarcodeTemplate(String(data.barcodeTemplate))
            : null,
          lengthMm: data.lengthMm ? Number(data.lengthMm) : null,
          widthMm: data.widthMm ? Number(data.widthMm) : null,
          heightMm: data.heightMm ? Number(data.heightMm) : null,
          weightOwnKg: data.weightOwnKg ? Number(data.weightOwnKg) : null,
          maxWeightKg: data.maxWeightKg ? Number(data.maxWeightKg) : null,
        },
      });
    },
  },
  pallets: {
    list: async () =>
      prisma.pallet.findMany({
        orderBy: { code: "asc" },
        include: { palletType: true },
      }),
    get: async (id) =>
      prisma.pallet.findUnique({
        where: { id },
        include: { palletType: true },
      }),
    create: async (data) => {
      const typeId = String(data.palletTypeId ?? "");
      const { code, barcode } = await allocatePalletCodes(typeId);
      return prisma.pallet.create({
        data: {
          code,
          barcode,
          palletTypeId: typeId,
          status: "AVAILABLE",
        },
      });
    },
    update: async (id, data) =>
      prisma.pallet.update({
        where: { id },
        data: {
          palletTypeId: String(data.palletTypeId ?? ""),
          // статус и штрихкод не меняем вручную
        },
      }),
  },
  cells: {
    list: async () =>
      prisma.location.findMany({
        orderBy: { code: "asc" },
        include: { zone: true },
      }),
    get: async (id) =>
      prisma.location.findUnique({ where: { id }, include: { zone: true } }),
    create: async (data) => {
      const code = String(data.code ?? "").trim();
      if (!code) return locThrow("errors.catalog.barcodeRequired");
      const zoneId = String(data.zoneId ?? "").trim();
      if (!zoneId) return locThrow("errors.catalog.zoneRequired");
      const type = await locationTypeFromZone(zoneId);
      return prisma.location.create({
        data: {
          code,
          name: String(data.name ?? "") || code,
          zoneId,
          type,
          barcode: code,
        },
      });
    },
    update: async (id, data) => {
      const code = String(data.code ?? "").trim();
      if (!code) return locThrow("errors.catalog.barcodeRequired");
      const zoneId = String(data.zoneId ?? "").trim();
      if (!zoneId) return locThrow("errors.catalog.zoneRequired");
      const type = await locationTypeFromZone(zoneId);
      return prisma.location.update({
        where: { id },
        data: {
          code,
          name: String(data.name ?? "") || code,
          zoneId,
          type,
          barcode: code,
        },
      });
    },
  },
  nomenclature: {
    list: async () =>
      prisma.product.findMany({
        orderBy: { sku: "asc" },
        include: { unit: true, accountingModel: true },
      }),
    get: async (id) =>
      prisma.product.findUnique({
        where: { id },
        include: { unit: true, accountingModel: true },
      }),
    create: async (data) => {
      const unitId = data.unitId ? String(data.unitId) : "";
      if (!unitId) return locThrow("errors.catalog.unitOfMeasureRequired");
      const barcode = data.barcode ? String(data.barcode) : null;
      const accountingModelId = await resolveAccountingModelId(
        data.accountingModelId,
      );
      const model = await prisma.accountingModel.findUniqueOrThrow({
        where: { id: accountingModelId },
      });
      const flags = flagsFromAccountingModel(model);
      const shelfLifeDays = flags.trackExpiry
        ? parseShelfLifeDays(data.shelfLifeDays)
        : null;
      const shelfLifeUnit = flags.trackExpiry
        ? parseShelfLifeUnit(data.shelfLifeUnit)
        : "DAY";
      const product = await prisma.product.create({
        data: {
          sku: String(data.sku ?? ""),
          name: String(data.name ?? ""),
          barcode,
          shelfLifeDays,
          shelfLifeUnit,
          accountingModelId,
          trackLots: flags.trackLots,
          trackExpiry: flags.trackExpiry,
          unitId,
        },
      });
      await ensureBasePackage(product.id, unitId, barcode);
      return product;
    },
    update: async (id, data) => {
      const unitId = data.unitId ? String(data.unitId) : "";
      if (!unitId) return locThrow("errors.catalog.unitOfMeasureRequired");
      const barcode = data.barcode ? String(data.barcode) : null;
      const accountingModelId = await resolveAccountingModelId(
        data.accountingModelId,
      );
      const model = await prisma.accountingModel.findUniqueOrThrow({
        where: { id: accountingModelId },
      });
      const flags = flagsFromAccountingModel(model);
      const shelfLifeDays = flags.trackExpiry
        ? parseShelfLifeDays(data.shelfLifeDays)
        : null;
      const shelfLifeUnit = flags.trackExpiry
        ? parseShelfLifeUnit(data.shelfLifeUnit)
        : "DAY";
      const product = await prisma.product.update({
        where: { id },
        data: {
          sku: String(data.sku ?? ""),
          name: String(data.name ?? ""),
          barcode,
          shelfLifeDays,
          shelfLifeUnit,
          accountingModelId,
          trackLots: flags.trackLots,
          trackExpiry: flags.trackExpiry,
          unitId,
        },
      });
      await ensureBasePackage(product.id, unitId, barcode);
      return product;
    },
  },
  accounting_models: {
    list: async () =>
      prisma.accountingModel.findMany({ orderBy: { name: "asc" } }),
    get: async (id) =>
      prisma.accountingModel.findUnique({ where: { id } }),
    create: async (data) => {
      const useLots = parseBool(data.useLots);
      const useSerial = useLots && parseBool(data.useSerial);
      const useExpiry = useLots && parseBool(data.useExpiry);
      return prisma.accountingModel.create({
        data: {
          code: `AM-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
          name: String(data.name ?? "").trim(),
          useLots,
          useExpiry,
          useSerial,
          lotNameTemplate:
            useLots && data.lotNameTemplate
              ? String(data.lotNameTemplate).trim()
              : null,
          isSystem: false,
        },
      });
    },
    update: async (id, data) => {
      const useLots = parseBool(data.useLots);
      const useSerial = useLots && parseBool(data.useSerial);
      const useExpiry = useLots && parseBool(data.useExpiry);
      const updated = await prisma.accountingModel.update({
        where: { id },
        data: {
          name: String(data.name ?? "").trim(),
          useLots,
          useExpiry,
          useSerial,
          lotNameTemplate:
            useLots && data.lotNameTemplate
              ? String(data.lotNameTemplate).trim()
              : null,
        },
      });
      const flags = flagsFromAccountingModel(updated);
      await prisma.product.updateMany({
        where: { accountingModelId: id },
        data: {
          trackLots: flags.trackLots,
          trackExpiry: flags.trackExpiry,
        },
      });
      return updated;
    },
  },
};

function parseBool(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "on" || s === "true" || s === "1";
}

async function resolveAccountingModelId(raw: unknown): Promise<string> {
  const id = String(raw ?? "").trim();
  if (id) {
    const found = await prisma.accountingModel.findFirst({
      where: { id, isActive: true },
    });
    if (found) return found.id;
  }
  await ensurePredefinedCatalog(prisma);
  const none = await prisma.accountingModel.findUnique({
    where: { code: "NONE" },
  });
  if (!none) return locThrow("errors.catalog.noLotsAccountingModelNotFound");
  return none.id;
}

function parseShelfLifeDays(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function parseShelfLifeUnit(raw: unknown): "DAY" | "WEEK" | "MONTH" | "YEAR" {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "WEEK" || s === "MONTH" || s === "YEAR" || s === "DAY") return s;
  return "DAY";
}

function valueFromForm(
  type: string,
  raw: FormDataEntryValue | null,
): string | number | boolean | null {
  const s = String(raw ?? "").trim();
  if (type === "bool") return raw === "on" || raw === "true";
  if (type === "number") return s ? Number(s) : null;
  if (!s) return null;
  return s;
}

function extensionAttrs(entity: MetaEntityFull) {
  return entity.attributes.filter((a) => !a.systemField && !a.isSystem);
}

async function loadExtensionMap(entityId: string, systemIds: string[]) {
  if (systemIds.length === 0) return new Map<string, Record<string, unknown>>();
  const records = await prisma.metaRecord.findMany({
    where: { entityId, code: { in: systemIds } },
    include: { values: { include: { attribute: true } } },
  });
  const map = new Map<string, Record<string, unknown>>();
  for (const r of records) {
    if (!r.code) continue;
    const values: Record<string, unknown> = {};
    for (const v of r.values) {
      values[v.attribute.code] =
        v.valueText ??
        v.valueNumber ??
        v.valueBool ??
        (v.valueDate ? v.valueDate.toISOString().slice(0, 10) : null);
    }
    map.set(r.code, values);
  }
  return map;
}

async function ensureExtensionRecord(entityId: string, systemId: string, title?: string) {
  const existing = await prisma.metaRecord.findUnique({
    where: { entityId_code: { entityId, code: systemId } },
  });
  if (existing) return existing;
  return prisma.metaRecord.create({
    data: {
      entityId,
      code: systemId,
      title: title ?? systemId,
    },
  });
}

export async function listCatalogRows(entityCode: string) {
  const entity = await getMetaEntity(entityCode);
  if (!entity) return { entity: null, rows: [] as Row[] };

  if (entity.storage === "system") {
    const handler = SYSTEM_HANDLERS[entityCode];
    if (!handler) return { entity, rows: [] as Row[] };
    const rows = await handler.list();
    const ext = extensionAttrs(entity);
    if (ext.length === 0) return { entity, rows };
    const map = await loadExtensionMap(
      entity.id,
      rows.map((r) => r.id),
    );
    return {
      entity,
      rows: rows.map((r) => ({ ...r, ...(map.get(r.id) ?? {}) })),
    };
  }

  const records = await prisma.metaRecord.findMany({
    where: { entityId: entity.id },
    include: { values: { include: { attribute: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = records.map((r) => {
    const row: Row = { id: r.id, code: r.code, title: r.title };
    for (const v of r.values) {
      const code = v.attribute.code;
      row[code] =
        v.valueText ??
        v.valueNumber ??
        v.valueBool ??
        (v.valueDate ? v.valueDate.toISOString().slice(0, 10) : null);
    }
    return row;
  });

  return { entity, rows };
}

export async function getCatalogRow(entityCode: string, id: string) {
  const entity = await getMetaEntity(entityCode);
  if (!entity) return { entity: null, row: null };

  if (entity.storage === "system") {
    const handler = SYSTEM_HANDLERS[entityCode];
    const row = handler ? await handler.get(id) : null;
    if (!row) return { entity, row: null };
    const map = await loadExtensionMap(entity.id, [id]);
    return { entity, row: { ...row, ...(map.get(id) ?? {}) } };
  }

  const record = await prisma.metaRecord.findUnique({
    where: { id },
    include: { values: { include: { attribute: true } } },
  });
  if (!record) return { entity, row: null };

  const row: Row = { id: record.id, code: record.code, title: record.title };
  for (const v of record.values) {
    row[v.attribute.code] =
      v.valueText ??
      v.valueNumber ??
      v.valueBool ??
      (v.valueDate ? v.valueDate.toISOString().slice(0, 10) : null);
  }
  return { entity, row };
}

export async function saveCatalogFromForm(
  entityCode: string,
  formData: FormData,
  id?: string,
) {
  const entity = await getMetaEntity(entityCode);
  if (!entity) return locThrow("errors.actions.entityNotFound");

  const systemData: Record<string, unknown> = {};
  const extensionData: Record<string, unknown> = {};
  for (const attr of entity.attributes) {
    const value = valueFromForm(attr.type, formData.get(attr.code));
    if (attr.systemField || attr.isSystem) {
      systemData[attr.systemField ?? attr.code] = value;
    } else {
      extensionData[attr.code] = value;
    }
  }

  if (entity.storage === "system") {
    const handler = SYSTEM_HANDLERS[entityCode];
    if (!handler) return locThrow("errors.meta.noSystemHandler");
    const row = id
      ? await handler.update(id, systemData)
      : await handler.create(systemData);

    if (Object.keys(extensionData).length > 0 || extensionAttrs(entity).length > 0) {
      const extRecord = await ensureExtensionRecord(
        entity.id,
        row.id,
        String(row.name ?? row.code ?? row.sku ?? row.id),
      );
      await upsertCustomValues(extRecord.id, extensionAttrs(entity), extensionData);
    }
    return { id: row.id };
  }

  const code = String(systemData.code ?? formData.get("code") ?? "") || null;
  const title =
    String(
      systemData.name ??
        systemData.number ??
        systemData.title ??
        formData.get("name") ??
        formData.get("number") ??
        code ??
        "",
    ) || null;

  // For custom, all attrs go to EAV (including code/name)
  const allData: Record<string, unknown> = {};
  for (const attr of entity.attributes) {
    allData[attr.code] = valueFromForm(attr.type, formData.get(attr.code));
  }

  if (id) {
    const record = await prisma.metaRecord.update({
      where: { id },
      data: { code, title },
    });
    await upsertCustomValues(record.id, entity.attributes, allData);
    return { id: record.id };
  }

  const record = await prisma.metaRecord.create({
    data: { entityId: entity.id, code, title },
  });
  await upsertCustomValues(record.id, entity.attributes, allData);
  return { id: record.id };
}

async function upsertCustomValues(
  recordId: string,
  attrs: MetaEntityFull["attributes"] | ReturnType<typeof extensionAttrs>,
  data: Record<string, unknown>,
) {
  for (const attr of attrs) {
    const raw = data[attr.code];
    const base = {
      valueText: null as string | null,
      valueNumber: null as number | null,
      valueBool: null as boolean | null,
      valueDate: null as Date | null,
    };
    if (attr.type === "number" && raw != null && raw !== "") {
      base.valueNumber = Number(raw);
    } else if (attr.type === "bool") {
      base.valueBool = Boolean(raw);
    } else if (attr.type === "date" && raw) {
      base.valueDate = new Date(String(raw));
    } else if (raw != null && raw !== "") {
      base.valueText = String(raw);
    }

    await prisma.metaValue.upsert({
      where: {
        recordId_attributeId: { recordId, attributeId: attr.id },
      },
      create: { recordId, attributeId: attr.id, ...base },
      update: base,
    });
  }
}

export async function listRefOptions(refEntityCode: string) {
  if (refEntityCode === "packages") {
    const rows = await prisma.package.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      include: { product: true },
    });
    return rows.map((r) => ({
      id: r.id,
      label: r.barcode
        ? `${r.product.sku} · ${r.name} · ${r.barcode}`
        : `${r.product.sku} · ${r.name}`,
    }));
  }

  if (refEntityCode === "zones") {
    const rows = await prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return rows.map((z) => ({
      id: z.id,
      label: `${z.name} · ${enumLabel(z.type)}`,
    }));
  }

  const { rows } = await listCatalogRows(refEntityCode);
  return rows.map((r) => ({
    id: r.id,
    label: String(r.name ?? r.title ?? r.code ?? r.sku ?? r.id),
  }));
}

export function displayCell(row: Row, field: string, attrType?: string): string {
  if (attrType === "ref" || /Id$/.test(field)) {
    const relKey = field.endsWith("Id") ? field.slice(0, -2) : field;
    const rel = row[relKey];
    if (rel && typeof rel === "object") {
      const o = rel as {
        sku?: string;
        name?: string;
        code?: string;
        type?: string;
      };
      if (relKey === "zone") {
        if (o.name && o.type) return `${o.name} · ${enumLabel(o.type)}`;
        if (o.name) return String(o.name);
      }
      if (o.sku && o.name) return `${o.sku} · ${o.name}`;
      if (o.name && o.code) return `${o.code} · ${o.name}`;
      if (o.name) return String(o.name);
      if (o.code) return String(o.code);
      if (o.sku) return String(o.sku);
    }
  }

  const v = row[field];
  if (v == null || v === "") return "—";
  if (typeof v === "object" && v && "name" in (v as object)) {
    const o = v as { sku?: string; name: string; code?: string };
    if (o.sku) return `${o.sku} · ${o.name}`;
    return String(o.name);
  }
  if (typeof v === "object" && v && "code" in (v as object)) {
    return String((v as { code: string }).code);
  }
  const text = String(v);
  if (attrType === "bool" || typeof v === "boolean") {
    return v === true || text === "true" ? "Да" : "Нет";
  }
  if (attrType === "enum" || field === "type" || field === "kind" || field === "status") {
    return enumLabel(text);
  }
  return text;
}
