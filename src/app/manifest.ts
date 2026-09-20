import type { MetadataRoute } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const isEn = locale === "en";

  return {
    name: isEn ? "WMS TSD" : "WMS ТСД",
    short_name: isEn ? "WMS TSD" : "WMS ТСД",
    description: isEn
      ? "WMS data collection terminal"
      : "Терминал сбора данных WMS",
    start_url: "/tsd",
    display: "standalone",
    background_color: "#f4f7f5",
    theme_color: "#0b6e4f",
    lang: locale,
    icons: [
      {
        src: "/icons/tsd-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/tsd-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
