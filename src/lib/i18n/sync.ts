import type { AppLocale } from "@/i18n/config";

type MessageTree = Record<string, unknown>;

const catalogs: Partial<Record<AppLocale, MessageTree>> = {};

export function registerMessageCatalog(locale: AppLocale, messages: MessageTree) {
  catalogs[locale] = deepMerge(catalogs[locale] ?? {}, messages);
}

export function translateSync(
  key: string,
  locale: AppLocale = "ru",
): string {
  const parts = key.split(".");
  let current: unknown = catalogs[locale];
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return key;
    }
    current = (current as MessageTree)[part];
  }
  return typeof current === "string" ? current : key;
}

export function translateSyncWithFallback(
  key: string,
  fallback: string,
  locale: AppLocale = "ru",
): string {
  const value = translateSync(key, locale);
  return value === key ? fallback : value;
}

function deepMerge(target: MessageTree, source: MessageTree): MessageTree {
  const result: MessageTree = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key] as MessageTree, value as MessageTree);
    } else {
      result[key] = value;
    }
  }
  return result;
}
