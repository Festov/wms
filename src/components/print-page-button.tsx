"use client";

import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui";

export function PrintPageButton() {
  const t = useTranslations("components.printPageButton");

  return (
    <button type="button" className={buttonClass} onClick={() => window.print()}>
      {t("label")}
    </button>
  );
}
