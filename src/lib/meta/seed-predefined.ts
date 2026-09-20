import type { PrismaClient } from "@/generated/prisma/client";

/** Предопределённые типы товарных носителей (НСИ «из коробки»). */
export const PREDEFINED_PALLET_TYPES = [
  {
    code: "EUR",
    name: "Европаллет",
    barcodeTemplate: "{TYPE}-{####}",
    lengthMm: 1200,
    widthMm: 800,
    heightMm: 144,
    weightOwnKg: 25,
    maxWeightKg: 1500,
  },
  {
    code: "FIN",
    name: "Финпаллет",
    barcodeTemplate: "{TYPE}-{####}",
    lengthMm: 1200,
    widthMm: 1000,
    heightMm: 144,
    weightOwnKg: 30,
    maxWeightKg: 1500,
  },
  {
    code: "US",
    name: "Американский паллет",
    barcodeTemplate: "{TYPE}-{####}",
    lengthMm: 1219,
    widthMm: 1016,
    heightMm: 144,
    weightOwnKg: 20,
    maxWeightKg: 1500,
  },
] as const;

/** Предопределённые единицы измерения. */
export const PREDEFINED_UNITS = [
  { code: "PCE", name: "Штука", symbol: "шт" },
  { code: "KG", name: "Килограмм", symbol: "кг" },
  { code: "G", name: "Грамм", symbol: "г" },
  { code: "T", name: "Тонна", symbol: "т" },
  { code: "M", name: "Метр", symbol: "м" },
  { code: "CM", name: "Сантиметр", symbol: "см" },
  { code: "MM", name: "Миллиметр", symbol: "мм" },
  { code: "M2", name: "Квадратный метр", symbol: "м²" },
  { code: "M3", name: "Кубический метр", symbol: "м³" },
  { code: "L", name: "Литр", symbol: "л" },
  { code: "ML", name: "Миллилитр", symbol: "мл" },
  { code: "PAK", name: "Упаковка", symbol: "упак" },
  { code: "BOX", name: "Коробка", symbol: "кор" },
  { code: "PR", name: "Пара", symbol: "пара" },
] as const;

/** Предопределённые модели учёта номенклатуры. */
export const PREDEFINED_ACCOUNTING_MODELS = [
  {
    code: "NONE",
    name: "Без партий",
    useLots: false,
    useExpiry: false,
    useSerial: false,
    lotNameTemplate: null as string | null,
  },
  {
    code: "BY_LOT",
    name: "По партиям",
    useLots: true,
    useExpiry: false,
    useSerial: false,
    lotNameTemplate: "{SKU}-{####}",
  },
  {
    code: "BY_LOT_EXPIRY",
    name: "Партии со сроком годности",
    useLots: true,
    useExpiry: true,
    useSerial: false,
    lotNameTemplate: "{SKU}-{YYYYMMDD}-{####}",
  },
  {
    code: "BY_SERIAL",
    name: "По серийным номерам",
    useLots: true,
    useExpiry: false,
    useSerial: true,
    lotNameTemplate: null as string | null,
  },
] as const;

/** Создаёт или обновляет предопределённые типы ТН. */
export async function ensurePredefinedPalletTypes(prisma: PrismaClient) {
  for (const row of PREDEFINED_PALLET_TYPES) {
    await prisma.palletType.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        name: row.name,
        barcodeTemplate: row.barcodeTemplate,
        lengthMm: row.lengthMm,
        widthMm: row.widthMm,
        heightMm: row.heightMm,
        weightOwnKg: row.weightOwnKg,
        maxWeightKg: row.maxWeightKg,
        isActive: true,
      },
      update: {
        name: row.name,
        barcodeTemplate: row.barcodeTemplate,
        lengthMm: row.lengthMm,
        widthMm: row.widthMm,
        heightMm: row.heightMm,
        weightOwnKg: row.weightOwnKg,
        maxWeightKg: row.maxWeightKg,
        isActive: true,
      },
    });
  }
}

/** Создаёт или обновляет предопределённые единицы измерения. */
export async function ensurePredefinedUnits(prisma: PrismaClient) {
  for (const row of PREDEFINED_UNITS) {
    await prisma.unit.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        name: row.name,
        symbol: row.symbol,
        isActive: true,
      },
      update: {
        name: row.name,
        symbol: row.symbol,
        isActive: true,
      },
    });
  }
}

/** Создаёт или обновляет предопределённые модели учёта. */
export async function ensurePredefinedAccountingModels(prisma: PrismaClient) {
  for (const row of PREDEFINED_ACCOUNTING_MODELS) {
    await prisma.accountingModel.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        name: row.name,
        useLots: row.useLots,
        useExpiry: row.useExpiry,
        useSerial: row.useSerial,
        lotNameTemplate: row.lotNameTemplate,
        isActive: true,
        isSystem: true,
      },
      update: {
        name: row.name,
        useLots: row.useLots,
        useExpiry: row.useExpiry,
        useSerial: row.useSerial,
        lotNameTemplate: row.lotNameTemplate,
        isActive: true,
        isSystem: true,
      },
    });
  }

  const none = await prisma.accountingModel.findUnique({
    where: { code: "NONE" },
  });
  const byLot = await prisma.accountingModel.findUnique({
    where: { code: "BY_LOT" },
  });
  const byExpiry = await prisma.accountingModel.findUnique({
    where: { code: "BY_LOT_EXPIRY" },
  });

  // Legacy: флаги на товаре без явной модели → подобрать модель
  if (byExpiry) {
    await prisma.product.updateMany({
      where: {
        trackLots: true,
        trackExpiry: true,
        accountingModelId: null,
      },
      data: { accountingModelId: byExpiry.id },
    });
  }
  if (byLot) {
    await prisma.product.updateMany({
      where: {
        trackLots: true,
        trackExpiry: false,
        accountingModelId: null,
      },
      data: { accountingModelId: byLot.id },
    });
  }
  if (none) {
    await prisma.product.updateMany({
      where: { accountingModelId: null },
      data: { accountingModelId: none.id },
    });
  }

  // Синхронизация флагов с выбранной моделью
  const models = await prisma.accountingModel.findMany();
  for (const m of models) {
    await prisma.product.updateMany({
      where: { accountingModelId: m.id },
      data: {
        trackLots: Boolean(m.useLots),
        trackExpiry: Boolean(m.useLots && m.useExpiry),
      },
    });
  }
}

/** Все предопределённые справочники НСИ. */
export async function ensurePredefinedCatalog(prisma: PrismaClient) {
  await ensurePredefinedPalletTypes(prisma);
  await ensurePredefinedUnits(prisma);
  await ensurePredefinedAccountingModels(prisma);
}

export function isPredefinedPalletTypeCode(code: string) {
  return PREDEFINED_PALLET_TYPES.some((t) => t.code === code);
}

export function isPredefinedUnitCode(code: string) {
  return PREDEFINED_UNITS.some((t) => t.code === code);
}

export function isPredefinedAccountingModelCode(code: string) {
  return PREDEFINED_ACCOUNTING_MODELS.some((t) => t.code === code);
}
