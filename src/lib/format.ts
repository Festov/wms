import type { AppLocale } from "@/i18n/config";
import { translateSyncWithFallback } from "@/lib/i18n/sync";
import { statusLabelFallback } from "@/lib/status/labels";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export { statusLabelFallback };

function intlLocale(locale: AppLocale) {
  return locale === "en" ? "en-US" : "ru-RU";
}

export function formatQty(
  value: number,
  unit?: string,
  locale: AppLocale = "ru",
) {
  const defaultUnit = locale === "en" ? "pcs" : "шт";
  return `${value.toLocaleString(intlLocale(locale))} ${unit ?? defaultUnit}`;
}

export function formatDate(
  value: Date | string | null | undefined,
  locale: AppLocale = "ru",
) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Локализованная подпись для системных enum-кодов (ячейки, контрагенты, статусы…). */
export function enumLabel(
  value: string | null | undefined,
  locale: AppLocale = "ru",
) {
  if (!value) return "—";
  return translateSyncWithFallback(`enums.${value}`, value, locale);
}

export function docStatusLabel(status: string, locale: AppLocale = "ru") {
  return statusLabelFallback(status, locale);
}

export function locationTypeLabel(type: string, locale: AppLocale = "ru") {
  return enumLabel(type, locale);
}

export function counterpartyKindLabel(kind: string, locale: AppLocale = "ru") {
  return enumLabel(kind, locale);
}

export function movementTypeLabel(type: string, locale: AppLocale = "ru") {
  return enumLabel(type, locale);
}
