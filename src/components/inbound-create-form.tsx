"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DataTable,
  Panel,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { CreateableSelect } from "@/components/createable-select";
import { MetaRecordFields } from "@/components/meta-record-fields";
import { createInboundDocument } from "@/lib/module-actions";
import {
  filterCreateSections,
  type DocumentFieldContext,
  type DocumentFormAttr,
} from "@/lib/meta/document-form-shared";

type Option = { id: string; label: string };
type LotOption = { id: string; productId: string; label: string };
type PackageOption = {
  id: string;
  productId: string;
  label: string;
  factor: number;
};

type LineDraft = {
  key: string;
  productId: string;
  packageId: string;
  quantity: string;
  lotId: string;
};

function emptyLine(): LineDraft {
  return {
    key: crypto.randomUUID(),
    productId: "",
    packageId: "",
    quantity: "1",
    lotId: "",
  };
}

export function InboundCreateForm({
  metaSections,
  fieldContext,
  products,
  packages = [],
  lots = [],
  lotsEnabled = false,
}: {
  metaSections: { code: string; name: string; attributes: DocumentFormAttr[] }[];
  fieldContext: DocumentFieldContext;
  products: Option[];
  packages?: PackageOption[];
  lots?: LotOption[];
  lotsEnabled?: boolean;
}) {
  const t = useTranslations("components.shared");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [extraLots, setExtraLots] = useState<LotOption[]>([]);
  const [extraProducts, setExtraProducts] = useState<Option[]>([]);
  const [extraDocks] = useState<
    { id: string; label: string; disabled?: boolean }[]
  >([]);
  const [extraTransport] = useState<Option[]>([]);

  const createSections = useMemo(
    () => filterCreateSections(metaSections),
    [metaSections],
  );

  const fieldContextWithExtras = useMemo(() => {
    const dockMap = new Map<string, { id: string; label: string; disabled?: boolean }>();
    for (const d of fieldContext.docks ?? []) dockMap.set(d.id, d);
    for (const d of extraDocks) dockMap.set(d.id, d);
    const transportMap = new Map<string, Option>();
    for (const u of fieldContext.transportUnits ?? []) transportMap.set(u.id, u);
    for (const u of extraTransport) transportMap.set(u.id, u);
    return {
      ...fieldContext,
      docks: [...dockMap.values()],
      transportUnits: [...transportMap.values()],
    };
  }, [fieldContext, extraDocks, extraTransport]);

  const allProducts = useMemo(() => {
    const map = new Map<string, Option>();
    for (const p of products) map.set(p.id, p);
    for (const p of extraProducts) map.set(p.id, p);
    return [...map.values()];
  }, [products, extraProducts]);

  const allLots = useMemo(() => {
    const map = new Map<string, LotOption>();
    for (const l of lots) map.set(l.id, l);
    for (const l of extraLots) map.set(l.id, l);
    return [...map.values()];
  }, [lots, extraLots]);

  const headers = lotsEnabled
    ? [
        { label: t("rowNo"), className: "text-center" },
        t("product"),
        t("package"),
        { label: t("quantityShort"), className: "text-center" },
        { label: t("base"), className: "text-center" },
        t("lot"),
        "",
      ]
    : [
        { label: t("rowNo"), className: "text-center" },
        t("product"),
        t("package"),
        { label: t("quantityShort"), className: "text-center" },
        { label: t("base"), className: "text-center" },
        "",
      ];

  return (
    <form action={createInboundDocument} className="space-y-4">
      <Panel title={t("details")}>
        <MetaRecordFields
          entityCode="inbound"
          sections={createSections}
          values={{}}
          context={fieldContextWithExtras}
          layout="form"
        />
      </Panel>

      <Panel
        flush
        title={t("goods")}
        actions={
          <button
            type="button"
            className={buttonSecondaryClass}
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            {t("addLine")}
          </button>
        }
      >
        <DataTable headers={headers}>
          {lines.map((line, index) => {
            const productLots = line.productId
              ? allLots.filter((l) => l.productId === line.productId)
              : [];
            const productPackages = line.productId
              ? packages.filter((p) => p.productId === line.productId)
              : [];
            const selectedPkg = productPackages.find(
              (p) => p.id === line.packageId,
            );
            const qty = Number(line.quantity);
            const baseQty =
              selectedPkg && Number.isFinite(qty)
                ? qty * selectedPkg.factor
                : null;

            return (
              <tr key={line.key} className="align-middle">
                <td className="px-3 py-2 text-center align-middle text-[var(--muted)]">
                  {index + 1}
                </td>
                <td className="min-w-[12rem] px-3 py-2 align-middle">
                  <CreateableSelect
                    name="lineProductId"
                    required
                    value={line.productId}
                    createKind="nomenclature"
                    createLabel={t("createNomenclature")}
                    options={allProducts}
                    onChange={(productId) => {
                      const pkgs = packages.filter(
                        (p) => p.productId === productId,
                      );
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? {
                                ...l,
                                productId,
                                packageId:
                                  pkgs.length === 1 ? pkgs[0].id : "",
                                lotId: "",
                              }
                            : l,
                        ),
                      );
                    }}
                    onCreated={(item) => {
                      setExtraProducts((prev) =>
                        prev.some((p) => p.id === item.id)
                          ? prev
                          : [...prev, { id: item.id, label: item.label }],
                      );
                    }}
                  />
                </td>
                <td className="min-w-[11rem] px-3 py-2 align-middle">
                  <select
                    className={inputClass}
                    name="linePackageId"
                    value={line.packageId}
                    disabled={!line.productId}
                    required
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, packageId: e.target.value }
                            : l,
                        ),
                      )
                    }
                  >
                    <option value="">
                      {!line.productId
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
                </td>
                <td className="w-28 px-3 py-2 text-center align-middle">
                  <input
                    className={`${inputClass} text-center`}
                    name="lineQuantity"
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    value={line.quantity}
                    title={t("packageQtyTitle")}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? { ...l, quantity: e.target.value }
                            : l,
                        ),
                      )
                    }
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-center align-middle text-[var(--muted)]">
                  {baseQty != null && selectedPkg
                    ? `${baseQty} (×${selectedPkg.factor})`
                    : "—"}
                </td>
                {lotsEnabled ? (
                  <td className="min-w-[11rem] px-3 py-2 align-middle">
                    <CreateableSelect
                      key={`${line.key}-${line.productId || "none"}`}
                      name="lineLotId"
                      value={line.lotId}
                      disabled={!line.productId}
                      createKind="lot"
                      createDefaults={
                        line.productId
                          ? { productId: line.productId }
                          : undefined
                      }
                      createLabel={t("createLot")}
                      emptyLabel={
                        line.productId ? "—" : t("selectProductFirst")
                      }
                      options={productLots.map((l) => ({
                        id: l.id,
                        label: l.label,
                      }))}
                      onChange={(lotId) =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.key === line.key ? { ...l, lotId } : l,
                          ),
                        )
                      }
                      onCreated={(item) => {
                        const productId =
                          item.productId || line.productId || "";
                        if (!productId || productId !== line.productId) return;
                        setExtraLots((prev) =>
                          prev.some((l) => l.id === item.id)
                            ? prev
                            : [
                                ...prev,
                                {
                                  id: item.id,
                                  productId,
                                  label: item.label,
                                },
                              ],
                        );
                      }}
                    />
                  </td>
                ) : null}
                <td className="px-3 py-2 align-middle">
                  <button
                    type="button"
                    className={buttonSecondaryClass}
                    disabled={lines.length <= 1}
                    onClick={() =>
                      setLines((prev) =>
                        prev.filter((l) => l.key !== line.key),
                      )
                    }
                  >
                    {t("remove")}
                  </button>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>

      <button className={buttonClass} type="submit">
        {t("createDocument")}
      </button>
    </form>
  );
}
