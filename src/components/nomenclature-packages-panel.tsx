"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DataTable,
  Field,
  Panel,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { CreateableSelect } from "@/components/createable-select";
import { updateProductPackage } from "@/lib/meta/actions";

export type PackageRow = {
  id: string;
  name: string;
  factor: number;
  barcode: string | null;
  unitId: string;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  weightGrossKg: number | null;
  unit: { symbol: string | null; name: string };
};

type Option = { id: string; label: string };

export function NomenclaturePackagesPanel({
  productId,
  packages,
  unitOptions,
  defaultUnitId,
  addPackageAction,
}: {
  productId: string;
  packages: PackageRow[];
  unitOptions: Option[];
  defaultUnitId: string;
  addPackageAction: (formData: FormData) => void | Promise<void>;
}) {
  const t = useTranslations("components.nomenclaturePackages");
  const ts = useTranslations("components.shared");
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = packages.find((p) => p.id === openId) ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
      <Panel flush title={t("title")}>
        <DataTable
          headers={[t("name"), t("factor"), t("unit"), t("barcodeShort")]}
          empty={packages.length === 0 ? t("empty") : undefined}
        >
          {packages.map((p) => (
            <tr
              key={p.id}
              className="cursor-pointer hover:bg-[var(--surface)]/60"
              onClick={() => setOpenId(p.id)}
            >
              <td className="px-3 py-2 font-medium">{p.name}</td>
              <td className="px-3 py-2">{p.factor}</td>
              <td className="px-3 py-2">{p.unit.symbol || p.unit.name}</td>
              <td className="px-3 py-2">{p.barcode ?? "—"}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel title={t("newTitle")}>
        <form action={addPackageAction} className="grid gap-3">
          <Field label={t("unitRequired")}>
            <CreateableSelect
              name="unitId"
              required
              options={unitOptions}
              createKind="unit"
              createLabel={t("createUnit")}
              emptyLabel={ts("selectPlaceholder")}
              defaultValue={defaultUnitId}
            />
          </Field>
          <Field label={t("factorRequired")}>
            <input
              className={inputClass}
              name="factor"
              type="number"
              step="any"
              min="0.0001"
              required
              defaultValue={10}
            />
          </Field>
          <Field label={t("barcode")}>
            <input
              className={inputClass}
              name="barcode"
              placeholder={t("barcodePlaceholder")}
            />
          </Field>
          <button className={buttonClass} type="submit">
            {t("add")}
          </button>
        </form>
      </Panel>

      {selected ? (
        <PackageEditDialog
          productId={productId}
          pkg={selected}
          unitOptions={unitOptions}
          onClose={() => {
            setOpenId(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function PackageEditDialog({
  productId,
  pkg,
  unitOptions,
  onClose,
}: {
  productId: string;
  pkg: PackageRow;
  unitOptions: Option[];
  onClose: () => void;
}) {
  const t = useTranslations("components.nomenclaturePackages");
  const tc = useTranslations("common");
  const ts = useTranslations("components.shared");
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">{pkg.name}</h3>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{t("editHint")}</p>
          </div>
          <button
            type="button"
            className={buttonSecondaryClass}
            onClick={onClose}
          >
            {t("close")}
          </button>
        </div>

        <form
          className="space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            setError(null);
            startTransition(async () => {
              try {
                await updateProductPackage(productId, pkg.id, formData);
                onClose();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : t("saveError"),
                );
              }
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("unitRequired")}>
              <select
                className={inputClass}
                name="unitId"
                required
                defaultValue={pkg.unitId}
              >
                {unitOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("factorRequired")}>
              <input
                className={inputClass}
                name="factor"
                type="number"
                step="any"
                min="0.0001"
                required
                defaultValue={pkg.factor}
              />
            </Field>
            <Field label={t("barcode")} className="sm:col-span-2">
              <input
                className={inputClass}
                name="barcode"
                defaultValue={pkg.barcode ?? ""}
                placeholder={t("barcodePlaceholder")}
              />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t("dimensions")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("lengthMm")}>
                <input
                  className={inputClass}
                  name="lengthMm"
                  type="number"
                  step="any"
                  defaultValue={pkg.lengthMm ?? ""}
                />
              </Field>
              <Field label={t("widthMm")}>
                <input
                  className={inputClass}
                  name="widthMm"
                  type="number"
                  step="any"
                  defaultValue={pkg.widthMm ?? ""}
                />
              </Field>
              <Field label={t("heightMm")}>
                <input
                  className={inputClass}
                  name="heightMm"
                  type="number"
                  step="any"
                  defaultValue={pkg.heightMm ?? ""}
                />
              </Field>
              <Field label={t("weightGrossKg")}>
                <input
                  className={inputClass}
                  name="weightGrossKg"
                  type="number"
                  step="any"
                  defaultValue={pkg.weightGrossKg ?? ""}
                />
              </Field>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-rose-700">{error}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={buttonSecondaryClass}
              onClick={onClose}
              disabled={pending}
            >
              {tc("cancel")}
            </button>
            <button className={buttonClass} type="submit" disabled={pending}>
              {pending ? ts("saving") : tc("save")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
