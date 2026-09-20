import type { AppLocale } from "@/i18n/config";
import { translateSyncWithFallback } from "@/lib/i18n/sync";

/** Синхронный fallback-лейбл статусов (без БД; для клиентских компонентов). */
export function statusLabelFallback(
  code: string | null | undefined,
  locale: AppLocale = "ru",
) {
  if (!code) return "—";
  return translateSyncWithFallback(`status.${code}`, code, locale);
}
