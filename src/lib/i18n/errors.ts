import type { AppLocale } from "@/i18n/config";
import { translateSync } from "@/lib/i18n/sync";

export function formatMessage(
  template: string,
  values?: Record<string, string | number>,
): string {
  if (!values) return template;
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.replaceAll(`{${key}}`, String(value));
  }
  return out;
}

export function localized(
  key: string,
  locale: AppLocale = "ru",
  values?: Record<string, string | number>,
): string {
  return formatMessage(translateSync(key, locale), values);
}
