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

type Option = { id: string; label: string };
type LotOption = { id: string; productId: string; label: string };
type PackageOption = {
  id: string;
  productId: string;
  label: string;
  factor: number;
};

export function InboundAddLineForm({
  action,
  products,
  packages = [],
  lots,
  lotsEnabled,
}: {
  action: (formData: FormData) => void | Promise<void>;
  products: Option[];
  packages?: PackageOption[];
  lots: LotOption[];
  lotsEnabled: boolean;
}) {
  const t = useTranslations("components.shared");
  const [productId, setProductId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [lotId, setLotId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const productLots = useMemo(
    () => (productId ? lots.filter((l) => l.productId === productId) : []),
    [lots, productId],
  );
  const productPackages = useMemo(
    () =>
      productId ? packages.filter((p) => p.productId === productId) : [],
    [packages, productId],
  );
  const selectedPkg = productPackages.find((p) => p.id === packageId);
  const qty = Number(quantity);
  const baseQty =
    selectedPkg && Number.isFinite(qty) ? qty * selectedPkg.factor : null;

  return (
    <Panel title={t("details")}>
      <form action={action} className="grid gap-3 md:grid-cols-2">
        <Field label={`${t("product")} *`}>
          <CreateableSelect
            name="productId"
            required
            value={productId}
            createKind="nomenclature"
            createLabel={t("createNomenclature")}
            options={products}
            onChange={(id) => {
              setProductId(id);
              const pkgs = packages.filter((p) => p.productId === id);
              setPackageId(pkgs.length === 1 ? pkgs[0].id : "");
              setLotId("");
            }}
          />
        </Field>
        <Field label={`${t("package")} *`}>
          <select
            className={inputClass}
            name="packageId"
            value={packageId}
            disabled={!productId}
            required
            onChange={(e) => setPackageId(e.target.value)}
          >
            <option value="">
              {!productId
                ? t("selectProductFirst")
                : productPackages.length === 0
                  ? t("noPackages")
                  : t("selectPackage")}
            </option>
            {productPackages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`${t("packageQtyRequired")}`}>
          <input
            className={inputClass}
            name="quantity"
            type="number"
            step="any"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field label={t("inBaseUnits")}>
          <p className="py-2 text-sm text-[var(--muted)]">
            {baseQty != null && selectedPkg
              ? `${baseQty} (×${selectedPkg.factor})`
              : "—"}
          </p>
        </Field>
        {lotsEnabled ? (
          <Field label={t("lot")}>
            <CreateableSelect
              key={productId || "no-product"}
              name="lotId"
              value={lotId}
              disabled={!productId}
              createKind="lot"
              createDefaults={productId ? { productId } : undefined}
              createLabel={t("createLot")}
              emptyLabel={productId ? "—" : t("selectProductFirst")}
              options={productLots.map((l) => ({
                id: l.id,
                label: l.label,
              }))}
              onChange={setLotId}
            />
          </Field>
        ) : null}
        <div className="flex items-end md:col-span-2">
          <button className={buttonClass} type="submit">
            {t("add")}
          </button>
        </div>
      </form>
    </Panel>
  );
}
