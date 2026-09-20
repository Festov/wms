export type ShelfLifeUnitCode = "DAY" | "WEEK" | "MONTH" | "YEAR";

/** Subtract shelf life from expiry using calendar days / weeks / months / years. */
export function subtractShelfLife(
  expiryDate: Date,
  value: number,
  unit: ShelfLifeUnitCode | string | null | undefined = "DAY",
): Date {
  const d = new Date(expiryDate.getTime());
  const n = Math.round(value);
  switch (unit) {
    case "WEEK":
      d.setUTCDate(d.getUTCDate() - n * 7);
      break;
    case "MONTH":
      d.setUTCMonth(d.getUTCMonth() - n);
      break;
    case "YEAR":
      d.setUTCFullYear(d.getUTCFullYear() - n);
      break;
    default:
      d.setUTCDate(d.getUTCDate() - n);
  }
  return d;
}

/** Срок годности = дата производства + срок хранения. */
export function addShelfLife(
  manufacturedAt: Date,
  value: number,
  unit: ShelfLifeUnitCode | string | null | undefined = "DAY",
): Date {
  const d = new Date(manufacturedAt.getTime());
  const n = Math.round(value);
  switch (unit) {
    case "WEEK":
      d.setUTCDate(d.getUTCDate() + n * 7);
      break;
    case "MONTH":
      d.setUTCMonth(d.getUTCMonth() + n);
      break;
    case "YEAR":
      d.setUTCFullYear(d.getUTCFullYear() + n);
      break;
    default:
      d.setUTCDate(d.getUTCDate() + n);
  }
  return d;
}

/** Production date = expiry − shelf life. Explicit manufacturedAt wins. */
export function calcManufacturedAt(
  expiryDate: Date | null | undefined,
  shelfLifeValue: number | null | undefined,
  shelfLifeUnit?: ShelfLifeUnitCode | string | null,
  explicit?: Date | null,
): Date | null {
  if (explicit) return explicit;
  if (!expiryDate || !shelfLifeValue || shelfLifeValue <= 0) return null;
  return subtractShelfLife(expiryDate, shelfLifeValue, shelfLifeUnit ?? "DAY");
}

export function hasProductShelfLife(
  shelfLifeDays: number | null | undefined,
): boolean {
  return Boolean(shelfLifeDays && shelfLifeDays > 0);
}

export type LotDatesInput = {
  expiryDate?: Date | null;
  manufacturedAt?: Date | null;
  shelfLifeDays?: number | null;
  shelfLifeUnit?: ShelfLifeUnitCode | string | null;
};

export type LotDatesResult =
  | { ok: true; expiryDate: Date; manufacturedAt: Date }
  | { ok: false; errorKey: string };

/**
 * При учёте срока годности:
 * — если у номенклатуры задан срок хранения: достаточно одной даты, вторая считается;
 * — если срока хранения нет: нужны обе даты.
 */
export function resolveLotDates(input: LotDatesInput): LotDatesResult {
  const expiry = input.expiryDate ?? null;
  const mfg = input.manufacturedAt ?? null;
  const days = input.shelfLifeDays ?? null;
  const unit = input.shelfLifeUnit ?? "DAY";
  const withShelfLife = hasProductShelfLife(days);

  if (withShelfLife) {
    if (!expiry && !mfg) {
      return { ok: false, errorKey: "lotDateOneRequired" };
    }
    if (expiry && mfg) {
      return { ok: true, expiryDate: expiry, manufacturedAt: mfg };
    }
    if (expiry) {
      const computed = calcManufacturedAt(expiry, days, unit, null);
      if (!computed) {
        return { ok: false, errorKey: "lotDateMfgCalcFailed" };
      }
      return { ok: true, expiryDate: expiry, manufacturedAt: computed };
    }
    const computed = addShelfLife(mfg!, days!, unit);
    return { ok: true, expiryDate: computed, manufacturedAt: mfg! };
  }

  if (!expiry || !mfg) {
    return { ok: false, errorKey: "lotDateBothRequired" };
  }
  return { ok: true, expiryDate: expiry, manufacturedAt: mfg };
}

/** YYYY-MM-DD из Date (UTC). */
export function toDateInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

/** Date из YYYY-MM-DD. */
export function parseDateInput(value: string | null | undefined): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Клиентский пересчёт второй даты при известном сроке хранения. */
export function peerDateFromShelfLife(opts: {
  source: "expiry" | "manufactured";
  value: string;
  shelfLifeDays: number;
  shelfLifeUnit?: string | null;
}): string {
  const parsed = parseDateInput(opts.value);
  if (!parsed || !hasProductShelfLife(opts.shelfLifeDays)) return "";
  if (opts.source === "expiry") {
    const mfg = subtractShelfLife(
      parsed,
      opts.shelfLifeDays,
      opts.shelfLifeUnit ?? "DAY",
    );
    return toDateInputValue(mfg);
  }
  const exp = addShelfLife(
    parsed,
    opts.shelfLifeDays,
    opts.shelfLifeUnit ?? "DAY",
  );
  return toDateInputValue(exp);
}
