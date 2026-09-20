"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { CreateableSelect } from "@/components/createable-select";
import { countCellsFromRackConfig } from "@/lib/location-batch-utils";
import { createRackCellsAction } from "@/lib/location-batch-actions";

type Option = { id: string; label: string };

export function RackConfigForm({
  zones,
  returnTo,
}: {
  zones: Option[];
  returnTo: string;
}) {
  const t = useTranslations("components.rackConfigForm");
  const [aisle, setAisle] = useState("01");
  const [rackCount, setRackCount] = useState(1);
  const [levelCount, setLevelCount] = useState(4);
  const [positionCount, setPositionCount] = useState(3);
  const [codeTemplate, setCodeTemplate] = useState("{A}-{R}-{L}-{P}");

  const { total } = useMemo(
    () =>
      countCellsFromRackConfig({
        rackCount,
        levelCount,
        positionCount,
      }),
    [rackCount, levelCount, positionCount],
  );

  const previewCode = useMemo(() => {
    const pad = (n: number, max: number) =>
      String(n).padStart(String(Math.max(1, max)).length, "0");
    return codeTemplate
      .replace(/\{A\}/gi, aisle || "01")
      .replace(/\{AISLE\}/gi, aisle || "01")
      .replace(/\{R\}/gi, pad(1, rackCount))
      .replace(/\{RACK\}/gi, pad(1, rackCount))
      .replace(/\{L\}/gi, pad(1, levelCount))
      .replace(/\{LEVEL\}/gi, pad(1, levelCount))
      .replace(/\{P\}/gi, pad(1, positionCount))
      .replace(/\{POS\}/gi, pad(1, positionCount))
      .replace(/\{POSITION\}/gi, pad(1, positionCount));
  }, [aisle, codeTemplate, rackCount, levelCount, positionCount]);

  return (
    <form action={createRackCellsAction} className="space-y-4">
      <input type="hidden" name="returnTo" value={returnTo} />

      <Panel title={t("configTitle")}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("aisle")}>
            <input
              className={inputClass}
              name="aisle"
              required
              value={aisle}
              onChange={(e) => setAisle(e.target.value)}
            />
          </Field>
          <Field label={t("zone")}>
            <CreateableSelect
              name="zoneId"
              required
              emptyLabel={t("selectZone")}
              createKind="zone"
              createLabel={t("createZone")}
              options={zones}
            />
          </Field>
          <Field label={t("rackCount")}>
            <input
              className={inputClass}
              name="rackCount"
              type="number"
              min={1}
              max={50}
              required
              value={rackCount}
              onChange={(e) => setRackCount(Number(e.target.value) || 1)}
            />
          </Field>
          <Field label={t("levelCount")}>
            <input
              className={inputClass}
              name="levelCount"
              type="number"
              min={1}
              max={20}
              required
              value={levelCount}
              onChange={(e) => setLevelCount(Number(e.target.value) || 1)}
            />
          </Field>
          <Field label={t("positionCount")}>
            <input
              className={inputClass}
              name="positionCount"
              type="number"
              min={1}
              max={50}
              required
              value={positionCount}
              onChange={(e) => setPositionCount(Number(e.target.value) || 1)}
            />
          </Field>
        </div>
      </Panel>

      <Panel title={t("barcodeTitle")}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("template")} className="md:col-span-2">
            <input
              className={inputClass}
              name="codeTemplate"
              required
              value={codeTemplate}
              onChange={(e) => setCodeTemplate(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              {t("templateHint", { preview: previewCode })}
            </p>
          </Field>
          <Field label={t("nameTemplate")}>
            <input
              className={inputClass}
              name="nameTemplate"
              placeholder={t("nameTemplatePlaceholder")}
            />
          </Field>
          <div className="flex items-end">
            <p className="text-sm text-[var(--muted)]">
              {t("willCreate", { total })}
            </p>
          </div>
        </div>
      </Panel>

      <button
        className={buttonClass}
        type="submit"
        disabled={total < 1 || total > 500}
      >
        {t("submit", { total })}
      </button>
    </form>
  );
}
