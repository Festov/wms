import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  DataTable,
  Field,
  Page,
  PageHeader,
  Panel,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { getNomenclatureFilterAttributes } from "@/lib/inventory-meta-filters";
import {
  INVENTORY_PAGE_SIZE,
  INVENTORY_PRESETS,
  detailRowPackageQty,
  inventoryFilterLabels,
  inventoryExportHref,
  inventoryPresetHref,
  inventoryReportQueryString,
  parseInventoryReportParams,
  queryInventoryReport,
  type InventoryGroupBy,
} from "@/lib/inventory-report";
import { requireModule, isModuleFlagEnabled } from "@/lib/session";

function groupLabel(
  t: (key: string) => string,
  key: InventoryGroupBy,
) {
  const map: Record<InventoryGroupBy, string> = {
    detail: t("groupDetail"),
    product: t("groupProduct"),
    zone: t("groupZone"),
    location: t("groupLocation"),
  };
  return map[key];
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireModule("inventory");
  const lotsEnabled = await isModuleFlagEnabled("lots");
  const raw = await searchParams;
  const params = parseInventoryReportParams(raw);
  const t = await getTranslations("pages.inventory");
  const tc = await getTranslations("pages.common");
  const tu = await getTranslations("units");

  const [zones, accountingModels, metaAttrs, report] = await Promise.all([
    prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.accountingModel.findMany({
      orderBy: { name: "asc" },
    }),
    getNomenclatureFilterAttributes(),
    params.shouldRun ? queryInventoryReport(params) : Promise.resolve(null),
  ]);

  const filterParts = inventoryFilterLabels(
    params,
    zones,
    accountingModels,
    metaAttrs,
  );
  const pageCount = report
    ? Math.max(1, Math.ceil(report.totalCount / INVENTORY_PAGE_SIZE))
    : 0;
  const exportCsvHref = params.shouldRun
    ? inventoryExportHref(params, "csv")
    : undefined;
  const exportXlsxHref = params.shouldRun
    ? inventoryExportHref(params, "xlsx")
    : undefined;
  const selectedMeta = metaAttrs.find((a) => a.code === params.metaAttr);

  const visiblePresets = INVENTORY_PRESETS.filter(
    (p) => !p.lotsOnly || lotsEnabled,
  );

  return (
    <Page>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            {exportCsvHref ? (
              <a href={exportCsvHref} className={buttonSecondaryClass}>
                {t("exportCsv")}
              </a>
            ) : null}
            {exportXlsxHref ? (
              <a href={exportXlsxHref} className={buttonSecondaryClass}>
                {t("exportExcel")}
              </a>
            ) : null}
          </>
        }
      />

      <Panel title={t("quickPresets")}>
        <div className="flex flex-wrap gap-2">
          {visiblePresets.map((preset) => (
            <Link
              key={preset.id}
              href={inventoryPresetHref(preset.id)}
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm transition-colors hover:border-[var(--accent)]"
            >
              {t(`presets.${preset.id}.label`)}
              {preset.hint ? (
                <span className="ml-1 text-xs text-[var(--muted)]">
                  · {t(`presets.${preset.id}.hint`)}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
        {zones.length > 0 ? (
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t("byZone")}
            </p>
            <div className="flex flex-wrap gap-2">
              {zones.map((zone) => (
                <Link
                  key={zone.id}
                  href={`/inventory?zoneId=${zone.id}`}
                  className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-sm hover:bg-[var(--surface)]"
                >
                  {zone.name}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel title={t("filters")}>
        <form
          method="get"
          className="space-y-3"
        >
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
            <Field label={t("product")} className="min-w-[10rem] flex-1">
              <input
                className={inputClass}
                name="q"
                defaultValue={params.q}
                placeholder={tc("skuOrName")}
              />
            </Field>
            <Field label={t("zone")} className="md:w-36 shrink-0">
              <select
                className={inputClass}
                name="zoneId"
                defaultValue={params.zoneId}
              >
                <option value="">{tc("allZones")}</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("location")} className="md:w-32 shrink-0">
              <input
                className={inputClass}
                name="location"
                defaultValue={params.location}
                placeholder={tc("code")}
              />
            </Field>
            {lotsEnabled ? (
              <Field label={t("lot")} className="md:w-32 shrink-0">
                <input
                  className={inputClass}
                  name="lot"
                  defaultValue={params.lot}
                  placeholder={tc("number")}
                />
              </Field>
            ) : null}
            <Field label={t("pallet")} className="md:w-32 shrink-0">
              <input
                className={inputClass}
                name="pallet"
                defaultValue={params.pallet}
                placeholder={tc("code")}
              />
            </Field>
            <Field label={t("groupBy")} className="md:w-44 shrink-0">
              <select
                className={inputClass}
                name="groupBy"
                defaultValue={params.groupBy}
              >
                {(
                  ["detail", "product", "zone", "location"] as InventoryGroupBy[]
                ).map((key) => (
                  <option key={key} value={key}>
                    {groupLabel(t, key)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
            <Field label={t("accountingModel")} className="md:w-48 shrink-0">
              <select
                className={inputClass}
                name="accountingModelId"
                defaultValue={params.accountingModelId}
              >
                <option value="">{tc("allModels")}</option>
                {accountingModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </Field>
            {metaAttrs.length > 0 ? (
              <>
                <Field label={t("metaAttr")} className="md:w-44 shrink-0">
                  <select
                    className={inputClass}
                    name="metaAttr"
                    defaultValue={params.metaAttr}
                  >
                    <option value="">—</option>
                    {metaAttrs.map((attr) => (
                      <option key={attr.code} value={attr.code}>
                        {attr.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={tc("value")} className="md:w-40 shrink-0">
                  {selectedMeta?.type === "enum" && selectedMeta.enumValues ? (
                    <select
                      className={inputClass}
                      name="metaValue"
                      defaultValue={params.metaValue}
                    >
                      <option value="">—</option>
                      {selectedMeta.enumValues.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : selectedMeta?.type === "bool" ? (
                    <select
                      className={inputClass}
                      name="metaValue"
                      defaultValue={params.metaValue}
                    >
                      <option value="">—</option>
                      <option value="1">{tc("yes")}</option>
                      <option value="0">{tc("no")}</option>
                    </select>
                  ) : (
                    <input
                      className={inputClass}
                      name="metaValue"
                      defaultValue={params.metaValue}
                      placeholder={tc("value")}
                    />
                  )}
                </Field>
              </>
            ) : null}
            {lotsEnabled ? (
              <Field label={t("expiringDays")} className="md:w-36 shrink-0">
                <input
                  className={inputClass}
                  type="number"
                  name="expiringDays"
                  min={1}
                  max={365}
                  defaultValue={params.expiringDays ?? ""}
                  placeholder="30"
                />
              </Field>
            ) : null}
            <div className="flex items-end gap-2">
              <button type="submit" className={buttonClass}>
                {tc("show")}
              </button>
              {params.shouldRun ? (
                <Link href="/inventory" className={buttonSecondaryClass}>
                  {tc("reset")}
                </Link>
              ) : null}
            </div>
          </div>
        </form>
      </Panel>

      <Panel
        flush
        title={
          params.shouldRun
            ? `${tc("result")}${filterParts.length ? ` · ${filterParts.join(" · ")}` : ""}`
            : tc("result")
        }
      >
        {!params.shouldRun ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            {t("emptyHint")}
          </p>
        ) : !report || report.totalCount === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            {t("noResults")}
          </p>
        ) : report.mode === "detail" ? (
          <>
            <DataTable
              headers={[
                t("product"),
                t("zone"),
                t("location"),
                t("pallet"),
                t("package"),
                t("packagesShort"),
                ...(lotsEnabled ? [t("lot"), t("expiry")] : []),
                t("base"),
              ]}
            >
              {report.rows.map((b) => {
                const pkgCount = detailRowPackageQty(b);
                const unit = b.product.unit?.name ?? tu("pcs");
                return (
                  <tr key={b.id}>
                    <td className="px-3 py-2">
                      {b.product.sku} {b.product.name}
                    </td>
                    <td className="px-3 py-2">
                      {b.location.zone?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2">{b.location.code}</td>
                    <td className="px-3 py-2">{b.pallet?.code ?? "—"}</td>
                    <td className="px-3 py-2">
                      {b.package ? b.package.name : t("baseUnit")}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {pkgCount != null
                        ? Number.isInteger(pkgCount)
                          ? pkgCount
                          : pkgCount.toFixed(2)
                        : "—"}
                    </td>
                    {lotsEnabled ? (
                      <>
                        <td className="px-3 py-2">{b.lot?.number ?? "—"}</td>
                        <td className="px-3 py-2 text-[var(--muted)]">
                          {b.lot?.expiryDate
                            ? b.lot.expiryDate.toISOString().slice(0, 10)
                            : "—"}
                        </td>
                      </>
                    ) : null}
                    <td className="px-3 py-2">
                      {b.quantity} {unit}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
            <ReportFooter
              params={params}
              totalCount={report.totalCount}
              pageCount={pageCount}
              truncated={report.truncated}
              paginationBack={tc("paginationBack")}
              paginationForward={tc("paginationForward")}
              truncatedWarning={tc("truncatedWarning")}
            />
          </>
        ) : (
          <>
            <DataTable
              headers={
                report.rows[0]?.groupBy === "product"
                  ? [t("product"), t("quantity"), t("rows"), t("accountingModel")]
                  : report.rows[0]?.groupBy === "zone"
                    ? [t("zone"), t("product"), t("quantity"), t("rows")]
                    : [t("zone"), t("location"), t("product"), t("quantity"), t("rows")]
              }
            >
              {report.rows.map((r) => {
                const unit = r.product.unit?.name ?? tu("pcs");
                if (r.groupBy === "product") {
                  return (
                    <tr key={r.key}>
                      <td className="px-3 py-2">
                        {r.product.sku} {r.product.name}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {r.quantity} {unit}
                      </td>
                      <td className="px-3 py-2 text-[var(--muted)]">
                        {r.lineCount}
                      </td>
                      <td className="px-3 py-2 text-sm text-[var(--muted)]">
                        {r.product.accountingModel?.name ?? "—"}
                      </td>
                    </tr>
                  );
                }
                if (r.groupBy === "zone") {
                  return (
                    <tr key={r.key}>
                      <td className="px-3 py-2">{r.zoneName ?? "—"}</td>
                      <td className="px-3 py-2">
                        {r.product.sku} {r.product.name}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {r.quantity} {unit}
                      </td>
                      <td className="px-3 py-2 text-[var(--muted)]">
                        {r.lineCount}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={r.key}>
                    <td className="px-3 py-2">{r.zoneName ?? "—"}</td>
                    <td className="px-3 py-2">{r.locationCode ?? "—"}</td>
                    <td className="px-3 py-2">
                      {r.product.sku} {r.product.name}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {r.quantity} {unit}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted)]">
                      {r.lineCount}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
            <ReportFooter
              params={params}
              totalCount={report.totalCount}
              pageCount={pageCount}
              truncated={report.truncated}
              paginationBack={tc("paginationBack")}
              paginationForward={tc("paginationForward")}
              truncatedWarning={tc("truncatedWarning")}
            />
          </>
        )}
      </Panel>
    </Page>
  );
}

function ReportFooter({
  params,
  totalCount,
  pageCount,
  truncated,
  paginationBack,
  paginationForward,
  truncatedWarning,
}: {
  params: ReturnType<typeof parseInventoryReportParams>;
  totalCount: number;
  pageCount: number;
  truncated?: boolean;
  paginationBack: string;
  paginationForward: string;
  truncatedWarning: string;
}) {
  return (
    <div className="space-y-1 border-t border-[var(--line)] px-4 py-2 text-xs text-[var(--muted)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          {(params.page - 1) * INVENTORY_PAGE_SIZE + 1}–
          {Math.min(params.page * INVENTORY_PAGE_SIZE, totalCount)} из {totalCount}
        </span>
        {pageCount > 1 ? (
          <div className="flex gap-2">
            {params.page > 1 ? (
              <Link
                href={`/inventory?${inventoryReportQueryString(params, { page: params.page - 1 })}`}
                className="text-[var(--accent)] hover:underline"
              >
                {paginationBack}
              </Link>
            ) : null}
            <span>
              {params.page} / {pageCount}
            </span>
            {params.page < pageCount ? (
              <Link
                href={`/inventory?${inventoryReportQueryString(params, { page: params.page + 1 })}`}
                className="text-[var(--accent)] hover:underline"
              >
                {paginationForward}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      {truncated ? (
        <p>{truncatedWarning}</p>
      ) : null}
    </div>
  );
}
