import { prisma } from "@/lib/db";
import { throwLocalized } from "@/lib/i18n/errors-server";
import {
  calcManufacturedAt,
  resolveLotDates,
  type ShelfLifeUnitCode,
} from "@/lib/lot-dates";

export type { ShelfLifeUnitCode };
export {
  addShelfLife,
  calcManufacturedAt,
  subtractShelfLife,
} from "@/lib/lot-dates";

export type StockTx = {
  stockBalance: {
    findUnique: typeof prisma.stockBalance.findUnique;
    findMany: typeof prisma.stockBalance.findMany;
    update: typeof prisma.stockBalance.update;
    create: typeof prisma.stockBalance.create;
    delete: typeof prisma.stockBalance.delete;
  };
  lot: {
    findUnique: typeof prisma.lot.findUnique;
    findMany: typeof prisma.lot.findMany;
    create: typeof prisma.lot.create;
    update: typeof prisma.lot.update;
  };
  product: {
    findUniqueOrThrow: typeof prisma.product.findUniqueOrThrow;
  };
};

export function lotKeyOf(lotId: string | null | undefined) {
  return lotId ?? "";
}

export function palletKeyOf(palletId: string | null | undefined) {
  return palletId ?? "";
}

export function packageKeyOf(packageId: string | null | undefined) {
  return packageId ?? "";
}

export async function ensureLot(
  tx: StockTx,
  productId: string,
  lotNumber: string,
  expiryDate?: Date | null,
  manufacturedAt?: Date | null,
) {
  const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });

  let resolvedExpiry = expiryDate ?? null;
  let resolvedMfg = manufacturedAt ?? null;

  if (resolvedExpiry || resolvedMfg) {
    const dates = resolveLotDates({
      expiryDate: resolvedExpiry,
      manufacturedAt: resolvedMfg,
      shelfLifeDays: product.shelfLifeDays,
      shelfLifeUnit: product.shelfLifeUnit,
    });
    if (dates.ok) {
      resolvedExpiry = dates.expiryDate;
      resolvedMfg = dates.manufacturedAt;
    } else if (resolvedExpiry && !resolvedMfg) {
      resolvedMfg = calcManufacturedAt(
        resolvedExpiry,
        product.shelfLifeDays,
        product.shelfLifeUnit,
        null,
      );
    }
  }

  const existing = await tx.lot.findUnique({
    where: { productId_number: { productId, number: lotNumber } },
  });
  if (existing) {
    const patch: {
      expiryDate?: Date | null;
      manufacturedAt?: Date | null;
    } = {};
    if (!existing.expiryDate && resolvedExpiry) {
      patch.expiryDate = resolvedExpiry;
    }
    if (!existing.manufacturedAt && resolvedMfg) {
      patch.manufacturedAt = resolvedMfg;
    }
    if (Object.keys(patch).length > 0) {
      return tx.lot.update({ where: { id: existing.id }, data: patch });
    }
    return existing;
  }
  return tx.lot.create({
    data: {
      productId,
      number: lotNumber,
      expiryDate: resolvedExpiry,
      manufacturedAt: resolvedMfg,
    },
  });
}

export async function bumpStock(
  tx: StockTx,
  productId: string,
  locationId: string,
  delta: number,
  allowNegative: boolean,
  lotId: string | null = null,
  palletId: string | null = null,
  packageId: string | null = null,
) {
  const lotKey = lotKeyOf(lotId);
  const palletKey = palletKeyOf(palletId);
  const packageKey = packageKeyOf(packageId);
  const existing = await tx.stockBalance.findUnique({
    where: {
      productId_locationId_lotKey_palletKey_packageKey: {
        productId,
        locationId,
        lotKey,
        palletKey,
        packageKey,
      },
    },
  });

  const nextQty = (existing?.quantity ?? 0) + delta;
  if (!allowNegative && nextQty < 0) {
    return throwLocalized("errors.stock.insufficientBalance");
  }

  if (existing) {
    if (nextQty === 0) {
      await tx.stockBalance.delete({ where: { id: existing.id } });
    } else {
      await tx.stockBalance.update({
        where: { id: existing.id },
        data: { quantity: nextQty },
      });
    }
  } else if (nextQty !== 0) {
    await tx.stockBalance.create({
      data: {
        productId,
        locationId,
        lotId,
        lotKey,
        palletId,
        palletKey,
        packageId,
        packageKey,
        quantity: nextQty,
      },
    });
  }
}

/** Move all stock on a TN from one location to another (putaway). */
export async function transferPalletStock(
  tx: StockTx & {
    stockMovement: { create: typeof prisma.stockMovement.create };
    pallet: { update: typeof prisma.pallet.update };
  },
  palletId: string,
  fromLocationId: string,
  toLocationId: string,
  referenceType?: string,
  referenceId?: string,
) {
  const balances = await tx.stockBalance.findMany({
    where: { palletId, locationId: fromLocationId, quantity: { gt: 0 } },
  });

  for (const bal of balances) {
    await bumpStock(
      tx,
      bal.productId,
      fromLocationId,
      -bal.quantity,
      false,
      bal.lotId,
      palletId,
      bal.packageId,
    );
    await bumpStock(
      tx,
      bal.productId,
      toLocationId,
      bal.quantity,
      true,
      bal.lotId,
      palletId,
      bal.packageId,
    );
    await tx.stockMovement.create({
      data: {
        type: "TRANSFER",
        productId: bal.productId,
        lotId: bal.lotId,
        palletId,
        packageId: bal.packageId,
        fromLocationId,
        toLocationId,
        quantity: bal.quantity,
        referenceType: referenceType ?? "PUTAWAY",
        referenceId,
        note: "Размещение ТН",
      },
    });
  }

  await tx.pallet.update({
    where: { id: palletId },
    data: { locationId: toLocationId },
  });

  return balances.length;
}

export async function nextDocNumber(prefix: "IN" | "OUT") {
  const year = new Date().getFullYear();
  const latest =
    prefix === "IN"
      ? await prisma.inboundDocument.findFirst({
          where: { number: { startsWith: `${prefix}-${year}-` } },
          orderBy: { number: "desc" },
        })
      : await prisma.outboundDocument.findFirst({
          where: { number: { startsWith: `${prefix}-${year}-` } },
          orderBy: { number: "desc" },
        });

  const next = latest
    ? Number(latest.number.split("-").at(-1) ?? "0") + 1
    : 1;

  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}

export function parseOptionalDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Сколько упаковок соответствует базовому количеству. */
export function packageCountFromBase(
  baseQty: number,
  factor: number | null | undefined,
) {
  if (!factor || factor <= 0) return null;
  const n = baseQty / factor;
  return Number.isFinite(n) ? n : null;
}
