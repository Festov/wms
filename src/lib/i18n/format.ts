import { getLocale } from "next-intl/server";
import {
  formatDate as formatDateBase,
  formatQty as formatQtyBase,
} from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export async function getFormatLocale(): Promise<AppLocale> {
  const locale = await getLocale();
  return locale === "en" ? "en" : "ru";
}

export function formatDateForLocale(
  value: Date | string | null | undefined,
  locale: AppLocale,
) {
  return formatDateBase(value, locale);
}

export function formatQtyForLocale(
  value: number,
  locale: AppLocale,
  unit?: string,
) {
  return formatQtyBase(value, unit, locale);
}

export async function formatDateLocalized(
  value: Date | string | null | undefined,
) {
  return formatDateForLocale(value, await getFormatLocale());
}

export async function formatDateLocalizedSync(
  value: Date | string | null | undefined,
  locale: AppLocale,
) {
  return formatDateForLocale(value, locale);
}

// Re-export base helpers for callers not yet migrated.
export { formatDateBase as formatDate, formatQtyBase as formatQty };
