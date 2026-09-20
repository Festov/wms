import { headers } from "next/headers";
import { defaultLocale, type AppLocale } from "@/i18n/config";
import { resolveApiLocaleFromHeaders } from "@/lib/i18n/api";
import { translateSync } from "@/lib/i18n/sync";

export async function getApiLocale(): Promise<AppLocale> {
  try {
    const h = await headers();
    return resolveApiLocaleFromHeaders((name) => h.get(name));
  } catch {
    return defaultLocale;
  }
}

export async function throwActionError(key: string): Promise<never> {
  const locale = await getApiLocale();
  throw new Error(translateSync(`errors.actions.${key}`, locale));
}
