import { getApiLocale } from "@/lib/i18n/locale-server";
import { localized } from "@/lib/i18n/errors";

export async function throwLocalized(
  key: string,
  values?: Record<string, string | number>,
): Promise<never> {
  const locale = await getApiLocale();
  throw new Error(localized(key, locale, values));
}
