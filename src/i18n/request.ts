import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  defaultLocale,
  isAppLocale,
  locales,
  LOCALE_COOKIE,
  type AppLocale,
} from "@/i18n/config";
import { registerMessageCatalog } from "@/lib/i18n/sync";

async function loadMessages(locale: AppLocale) {
  return (await import(`../../messages/${locale}.json`)).default;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isAppLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const [ruMessages, enMessages] = await Promise.all(
    locales.map((loc) => loadMessages(loc)),
  );
  registerMessageCatalog("ru", ruMessages);
  registerMessageCatalog("en", enMessages);

  return {
    locale,
    messages: locale === "en" ? enMessages : ruMessages,
  };
});
