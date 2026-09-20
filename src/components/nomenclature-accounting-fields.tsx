"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CreateableSelect } from "@/components/createable-select";
import { Field, inputClass } from "@/components/ui";
import { enumLabel } from "@/lib/format";

export type AccountingModelOption = {
  id: string;
  label: string;
  code?: string;
  useExpiry: boolean;
};

type Props = {
  models: AccountingModelOption[];
  defaultAccountingModelId?: string;
  defaultShelfLifeDays?: string;
  defaultShelfLifeUnit?: string;
  required?: boolean;
};

/**
 * Модель учёта + срок хранения номенклатуры.
 * Срок хранения и единица показываются только если в модели включён срок годности.
 */
export function NomenclatureAccountingFields({
  models,
  defaultAccountingModelId = "",
  defaultShelfLifeDays = "",
  defaultShelfLifeUnit = "DAY",
  required = true,
}: Props) {
  const t = useTranslations("components.nomenclatureAccounting");
  const [modelId, setModelId] = useState(defaultAccountingModelId);
  const selected = useMemo(
    () => models.find((m) => m.id === modelId) ?? null,
    [models, modelId],
  );
  const showShelfLife = Boolean(selected?.useExpiry);

  return (
    <>
      <Field label={required ? t("modelRequired") : t("model")}>
        <CreateableSelect
          name="accountingModelId"
          required={required}
          options={models.map((m) => ({ id: m.id, label: m.label }))}
          value={modelId}
          onChange={setModelId}
          showAll={false}
          emptyLabel="—"
        />
      </Field>

      {showShelfLife ? (
        <div key={modelId} className="contents">
          <Field label={t("shelfLife")}>
            <input
              className={inputClass}
              name="shelfLifeDays"
              type="number"
              step="1"
              min="1"
              defaultValue={defaultShelfLifeDays}
              placeholder={t("numberPlaceholder")}
            />
          </Field>
          <Field label={t("shelfLifeUnit")}>
            <select
              className={inputClass}
              name="shelfLifeUnit"
              defaultValue={defaultShelfLifeUnit || "DAY"}
            >
              {(["DAY", "WEEK", "MONTH", "YEAR"] as const).map((v) => (
                <option key={v} value={v}>
                  {enumLabel(v)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : (
        <>
          {/* Сброс при модели без срока годности */}
          <input type="hidden" name="shelfLifeDays" value="" />
          <input type="hidden" name="shelfLifeUnit" value="DAY" />
        </>
      )}
    </>
  );
}
