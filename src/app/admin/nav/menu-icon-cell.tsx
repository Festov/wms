"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Icon, ICON_KEYS } from "@/components/icons";
import { inputClass } from "@/components/ui";

export function MenuIconCell({
  formId,
  initialIconKey,
  label,
}: {
  formId: string;
  initialIconKey: string;
  label: string;
}) {
  const t = useTranslations("dialogs.admin.nav");
  const [iconKey, setIconKey] = useState(initialIconKey);

  return (
    <>
      <td className="px-3 py-2">
        <div
          className="flex h-[2.375rem] items-center gap-2 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]/60 px-3"
          title={t("menuPreviewTitle")}
        >
          <Icon name={iconKey} className="size-4 shrink-0 text-[var(--ink)]" />
          <span className="truncate text-sm">{label}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <select
          className={inputClass}
          value={iconKey}
          onChange={(e) => setIconKey(e.target.value)}
          aria-label={t("iconAria", { label })}
          form={formId}
          name="iconKey"
        >
          {ICON_KEYS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </td>
    </>
  );
}
