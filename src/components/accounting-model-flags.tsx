"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Field, inputClass } from "@/components/ui";

type Props = {
  useLots?: boolean;
  useExpiry?: boolean;
  useSerial?: boolean;
  lotNameTemplate?: string | null;
};

/**
 * Флаги модели учёта: сначала только «По партиям»,
 * остальные опции и шаблон — после включения партий.
 */
export function AccountingModelFlags({
  useLots: initialLots = false,
  useExpiry: initialExpiry = false,
  useSerial: initialSerial = false,
  lotNameTemplate: initialTemplate = "",
}: Props) {
  const t = useTranslations("components.accountingModelFlags");
  const [useLots, setUseLots] = useState(Boolean(initialLots));
  const [useExpiry, setUseExpiry] = useState(
    Boolean(initialLots && initialExpiry),
  );
  const [useSerial, setUseSerial] = useState(
    Boolean(initialLots && initialSerial),
  );
  const [template, setTemplate] = useState(initialTemplate ?? "");

  function onLotsChange(checked: boolean) {
    setUseLots(checked);
    if (!checked) {
      setUseExpiry(false);
      setUseSerial(false);
    }
  }

  return (
    <div className="md:col-span-2 space-y-3 rounded-lg border border-[var(--line)] bg-[var(--surface)]/40 p-3">
      <p className="text-xs text-[var(--muted)]">{t("hint")}</p>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="useLots"
          className="size-4"
          checked={useLots}
          onChange={(e) => onLotsChange(e.target.checked)}
        />
        <span className="font-medium">{t("useLots")}</span>
      </label>

      <label
        className={`flex items-center gap-3 text-sm ${useLots ? "" : "opacity-50"}`}
      >
        <input
          type="checkbox"
          name="useExpiry"
          className="size-4"
          checked={useExpiry}
          disabled={!useLots}
          onChange={(e) => setUseExpiry(e.target.checked)}
        />
        <span>{t("useExpiry")}</span>
      </label>

      <label
        className={`flex items-center gap-3 text-sm ${useLots ? "" : "opacity-50"}`}
      >
        <input
          type="checkbox"
          name="useSerial"
          className="size-4"
          checked={useSerial}
          disabled={!useLots}
          onChange={(e) => setUseSerial(e.target.checked)}
        />
        <span>{t("useSerial")}</span>
      </label>

      <Field
        label={t("lotNameTemplate")}
        className={useLots ? "" : "opacity-50"}
      >
        <input
          className={inputClass}
          name="lotNameTemplate"
          value={template}
          disabled={!useLots}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder="{SKU}-{YYYYMMDD}-{####}"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">{t("templateHint")}</p>
      </Field>
    </div>
  );
}
