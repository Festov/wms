"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { inputClass } from "@/components/ui";
import { setLocaleAction } from "@/lib/i18n/actions";
import { locales, type AppLocale } from "@/i18n/config";

export function LanguageSwitcher({
  labels,
}: {
  labels: Record<AppLocale, string>;
}) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function onLocaleChange(nextLocale: string) {
    if (nextLocale === locale) return;
    const formData = new FormData();
    formData.set("locale", nextLocale);
    formData.set("returnTo", pathname);
    startTransition(async () => {
      await setLocaleAction(formData);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className={inputClass}
        name="locale"
        value={locale}
        disabled={pending}
        onChange={(event) => onLocaleChange(event.target.value)}
        aria-label={labels[locale]}
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {labels[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
