export const locales = ["ru", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "ru";

export const LOCALE_COOKIE = "wms.locale";

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "ru" || value === "en";
}

export function resolveLocale(value: string | null | undefined): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}
