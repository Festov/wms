import type { AppLocale } from "@/i18n/config";
import { translateSyncWithFallback } from "@/lib/i18n/sync";

export function resolveStatusLabel(
  code: string | null | undefined,
  dbName: string | null | undefined,
  locale: AppLocale,
): string {
  if (!code) return "—";
  return translateSyncWithFallback(`status.${code}`, dbName ?? code, locale);
}

export function resolveLabelsJson(
  labelsJson: string | null | undefined,
  fallback: string,
  locale: AppLocale,
): string {
  if (!labelsJson) return fallback;
  try {
    const parsed = JSON.parse(labelsJson) as Record<string, string>;
    return parsed[locale] ?? parsed.ru ?? fallback;
  } catch {
    return fallback;
  }
}

export function serializeLabelsJson(
  labels: Partial<Record<AppLocale, string>>,
): string | null {
  const filtered = Object.fromEntries(
    Object.entries(labels).filter(([, value]) => Boolean(value)),
  );
  return Object.keys(filtered).length > 0 ? JSON.stringify(filtered) : null;
}
