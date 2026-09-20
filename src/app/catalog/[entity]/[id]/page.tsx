import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  Field,
  Page,
  PageHeader,
  Panel,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { CreateableSelect } from "@/components/createable-select";
import {
  createProductPackage,
  updateCatalogRecord,
} from "@/lib/meta/actions";
import { refCreateKind } from "@/lib/meta/ref-create";
import {
  getCatalogRow,
  listRefOptions,
} from "@/lib/meta/catalog";
import { enumLabel } from "@/lib/format";
import { prisma } from "@/lib/db";
import { getModuleFlags, requireUser } from "@/lib/session";
import { isPredefinedPalletTypeCode } from "@/lib/meta/seed-predefined";
import { NomenclaturePackagesPanel } from "@/components/nomenclature-packages-panel";
import { AccountingModelFlags } from "@/components/accounting-model-flags";
import { NomenclatureAccountingFields } from "@/components/nomenclature-accounting-fields";
import { ReceivingDockLinkedDocsPanel } from "@/components/receiving-dock-linked-docs-panel";

export default async function CatalogDetailPage({
  params,
}: {
  params: Promise<{ entity: string; id: string }>;
}) {
  await requireUser();
  const flags = await getModuleFlags();
  const { entity: entityCode, id } = await params;
  const tc = await getTranslations("pages.common");
  const tCat = await getTranslations("pages.catalog");
  const tSave = await getTranslations("common");
  const { entity, row } = await getCatalogRow(entityCode, id);
  if (!entity || !row) notFound();

  const refOptions: Record<string, { id: string; label: string }[]> = {};
  for (const attr of entity.attributes) {
    if (attr.type === "ref" && attr.refEntityCode) {
      refOptions[attr.code] = await listRefOptions(attr.refEntityCode);
    }
  }

  const sections =
    entity.sections.length > 0
      ? entity.sections
      : [
          {
            id: "_main",
            code: "main",
            name: tc("mainSection"),
            order: 0,
            entityId: entity.id,
          },
        ];

  const predefinedPalletType =
    entityCode === "pallet_types" &&
    isPredefinedPalletTypeCode(String(row.code ?? ""));

  const productPackages =
    entityCode === "nomenclature"
      ? await prisma.package.findMany({
          where: { productId: id },
          orderBy: { factor: "asc" },
          include: { unit: true },
        })
      : [];
  const unitOptions =
    entityCode === "nomenclature"
      ? (refOptions.unitId ?? (await listRefOptions("units")))
      : [];

  const accountingModels =
    entityCode === "nomenclature"
      ? (
          await prisma.accountingModel.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
          })
        ).map((m) => ({
          id: m.id,
          label: m.name,
          code: m.code,
          useExpiry: Boolean(m.useLots && m.useExpiry),
        }))
      : [];

  const receivingDockDocs =
    entityCode === "receiving_docks"
      ? await prisma.receivingDock.findUnique({
          where: { id },
          select: {
            inboundDocuments: {
              where: {
                status: { in: ["RELEASED", "ACCEPTED", "DRAFT", "PLACED"] },
              },
              orderBy: { updatedAt: "desc" },
              take: 10,
              select: { id: true, number: true, status: true },
            },
            outboundDocuments: {
              where: { status: { in: ["RELEASED", "DRAFT"] } },
              orderBy: { updatedAt: "desc" },
              take: 10,
              select: { id: true, number: true, status: true },
            },
          },
        })
      : null;

  const recordTitle =
    entityCode === "transport_units"
      ? String(row.plateNumber ?? row.code ?? entity.name)
      : String(row.name ?? row.title ?? row.code ?? row.sku ?? entity.name);

  async function action(formData: FormData) {
    "use server";
    await updateCatalogRecord(entityCode, id, formData);
  }

  async function addPackageAction(formData: FormData) {
    "use server";
    await createProductPackage(id, formData);
  }

  return (
    <Page key={`${entityCode}:${id}`}>
      <PageHeader
        title={recordTitle}
        description={
          predefinedPalletType
            ? `${entity.name} · ${tc("predefinedSuffix")}`
            : entity.name
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {entityCode === "nomenclature" && flags.lots ? (
              <Link
                href={`/lots?productId=${id}`}
                className={buttonSecondaryClass}
              >
                {tc("lots")}
              </Link>
            ) : null}
            <Link
              href={`/catalog/${entityCode}`}
              className={buttonSecondaryClass}
            >
              {tc("toList")}
            </Link>
          </div>
        }
      />

      <form action={action} className="space-y-4">
        <div
          className={
            entityCode === "packages"
              ? "grid gap-4 xl:grid-cols-2 xl:items-start"
              : "space-y-4"
          }
        >
        {sections.map((section) => {
          const toShow = entity.attributes.filter((a) => {
            if (a.sectionId) return a.sectionId === section.id;
            return section.code === "main";
          });
          if (toShow.length === 0) return null;

          const compactFields =
            entityCode === "packages" &&
            (section.code === "main" || section.code === "vgkh");

          return (
            <Panel key={section.id} title={section.name}>
              <div
                className={
                  compactFields ? "grid gap-3" : "grid gap-3 md:grid-cols-2"
                }
              >
                {toShow.map((attr) => {
                  const field = attr.systemField ?? attr.code;
                  const raw = row[field];
                  const value =
                    raw != null && typeof raw === "object"
                      ? ""
                      : raw == null
                        ? ""
                        : String(raw);
                  const refValue =
                    attr.type === "ref"
                      ? String(row[field] ?? "")
                      : value;

                  const readOnlyAuto =
                    (entityCode === "pallets" &&
                      (attr.code === "code" ||
                        attr.code === "barcode" ||
                        attr.code === "status")) ||
                    (entityCode === "packages" &&
                      (attr.code === "code" || attr.code === "name")) ||
                    (predefinedPalletType && attr.code === "code");

                  if (
                    entityCode === "pallets" &&
                    attr.code === "status"
                  ) {
                    return (
                      <Field key={attr.id} label={attr.name}>
                        <input
                          className={inputClass}
                          value={enumLabel(value)}
                          readOnly
                          disabled
                        />
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {tCat("palletStatusHint")}
                        </p>
                      </Field>
                    );
                  }
                  if (
                    entityCode === "packages" &&
                    (attr.code === "code" || attr.code === "name")
                  ) {
                    return (
                      <Field key={attr.id} label={attr.name}>
                        <input
                          className={inputClass}
                          value={value}
                          readOnly
                          disabled
                        />
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {tCat("packageNameHint")}
                        </p>
                      </Field>
                    );
                  }
                  if (
                    entityCode === "pallet_types" &&
                    attr.code === "barcodeTemplate"
                  ) {
                    return (
                      <Field
                        key={attr.id}
                        label={attr.name}
                        className="md:col-span-2"
                      >
                        <input
                          className={inputClass}
                          name={attr.code}
                          defaultValue={value}
                          placeholder="{TYPE}-{####}"
                        />
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {tCat("barcodeTemplateHint", {
                            TYPE: "{TYPE}",
                            HASHES: "{####}",
                          })}
                        </p>
                      </Field>
                    );
                  }
                  if (
                    entityCode === "nomenclature" &&
                    (attr.code === "shelfLifeDays" ||
                      attr.code === "shelfLifeUnit")
                  ) {
                    return null;
                  }
                  if (
                    entityCode === "nomenclature" &&
                    attr.code === "accountingModelId"
                  ) {
                    return (
                      <NomenclatureAccountingFields
                        key={attr.id}
                        models={accountingModels}
                        defaultAccountingModelId={String(
                          row.accountingModelId ?? "",
                        )}
                        defaultShelfLifeDays={
                          row.shelfLifeDays != null
                            ? String(row.shelfLifeDays)
                            : ""
                        }
                        defaultShelfLifeUnit={String(
                          row.shelfLifeUnit ?? "DAY",
                        )}
                        required={attr.required}
                      />
                    );
                  }
                  if (
                    entityCode === "accounting_models" &&
                    (attr.code === "useExpiry" ||
                      attr.code === "useSerial" ||
                      attr.code === "lotNameTemplate")
                  ) {
                    return null;
                  }
                  if (
                    entityCode === "accounting_models" &&
                    attr.code === "useLots"
                  ) {
                    return (
                      <AccountingModelFlags
                        key={attr.id}
                        useLots={Boolean(row.useLots)}
                        useExpiry={Boolean(row.useExpiry)}
                        useSerial={Boolean(row.useSerial)}
                        lotNameTemplate={
                          row.lotNameTemplate != null
                            ? String(row.lotNameTemplate)
                            : ""
                        }
                      />
                    );
                  }

                  return (
                    <Field
                      key={attr.id}
                      label={`${attr.name}${attr.required ? " *" : ""}`}
                    >
                      {attr.type === "bool" ? (
                        <input
                          type="checkbox"
                          name={attr.code}
                          className="size-4"
                          defaultChecked={Boolean(raw)}
                          disabled={readOnlyAuto}
                        />
                      ) : attr.type === "enum" ? (
                        <select
                          className={inputClass}
                          name={attr.code}
                          required={attr.required}
                          defaultValue={value}
                          disabled={readOnlyAuto}
                        >
                          <option value="">—</option>
                          {(attr.enumValues
                            ? (JSON.parse(attr.enumValues) as string[])
                            : []
                          ).map((v) => (
                            <option key={v} value={v}>
                              {enumLabel(v)}
                            </option>
                          ))}
                        </select>
                      ) : attr.type === "ref" && attr.refEntityCode ? (
                        <CreateableSelect
                          name={attr.code}
                          required={attr.required}
                          defaultValue={refValue}
                          options={refOptions[attr.code] ?? []}
                          createKind={refCreateKind(attr.refEntityCode)}
                          createLabel={tc("createRef")}
                          disabled={readOnlyAuto}
                        />
                      ) : (
                        <input
                          className={inputClass}
                          name={attr.code}
                          type={
                            attr.type === "number"
                              ? "number"
                              : attr.type === "date"
                                ? "date"
                                : "text"
                          }
                          required={attr.required && !readOnlyAuto}
                          defaultValue={value}
                          step={attr.type === "number" ? "any" : undefined}
                          readOnly={readOnlyAuto}
                        />
                      )}
                    </Field>
                  );
                })}
              </div>
            </Panel>
          );
        })}
        </div>

        <button className={buttonClass} type="submit">
          {tSave("save")}
        </button>
      </form>

      {entityCode === "nomenclature" ? (
        <NomenclaturePackagesPanel
          productId={id}
          packages={productPackages.map((p) => ({
            id: p.id,
            name: p.name,
            factor: p.factor,
            barcode: p.barcode,
            unitId: p.unitId,
            lengthMm: p.lengthMm,
            widthMm: p.widthMm,
            heightMm: p.heightMm,
            weightGrossKg: p.weightGrossKg,
            unit: { symbol: p.unit.symbol, name: p.unit.name },
          }))}
          unitOptions={unitOptions}
          defaultUnitId={String(row.unitId ?? "")}
          addPackageAction={addPackageAction}
        />
      ) : null}

      {receivingDockDocs ? (
        <ReceivingDockLinkedDocsPanel
          inboundDocuments={receivingDockDocs.inboundDocuments}
          outboundDocuments={receivingDockDocs.outboundDocuments}
        />
      ) : null}
    </Page>
  );
}
