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
import { AccountingModelFlags } from "@/components/accounting-model-flags";
import { NomenclatureAccountingFields } from "@/components/nomenclature-accounting-fields";
import { safeReturnTo } from "@/lib/create-href";
import { createCatalogRecord } from "@/lib/meta/actions";
import { getMetaEntity, listRefOptions } from "@/lib/meta/catalog";
import { refCreateKind } from "@/lib/meta/ref-create";
import { enumLabel } from "@/lib/format";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function CatalogNewPage({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string }>;
  searchParams: Promise<{ returnTo?: string; productId?: string }>;
}) {
  await requireUser();
  const { entity: entityCode } = await params;
  const sp = await searchParams;
  const tc = await getTranslations("pages.common");
  const tCat = await getTranslations("pages.catalog");
  const entity = await getMetaEntity(entityCode);
  if (!entity || entity.kind === "document") notFound();

  const returnTo = safeReturnTo(sp.returnTo, `/catalog/${entityCode}`);
  const presetProductId = String(sp.productId ?? "").trim();

  const refOptions: Record<string, { id: string; label: string }[]> = {};
  for (const attr of entity.attributes) {
    if (attr.type === "ref" && attr.refEntityCode) {
      refOptions[attr.code] = await listRefOptions(attr.refEntityCode);
    }
  }

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

  const defaultAccountingModelId =
    accountingModels.find((m) => m.code === "NONE")?.id ??
    accountingModels[0]?.id ??
    "";

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

  async function action(formData: FormData) {
    "use server";
    await createCatalogRecord(entityCode, formData);
  }

  return (
    <Page key={entityCode}>
      <PageHeader
        title={tc("newTitle", { name: entity.name })}
        actions={
          <Link href={returnTo} className={buttonSecondaryClass}>
            {tc("back")}
          </Link>
        }
      />

      <form action={action} className="space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
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
                  if (
                    entityCode === "pallets" &&
                    (attr.code === "code" ||
                      attr.code === "barcode" ||
                      attr.code === "status")
                  ) {
                    return null;
                  }
                  if (
                    entityCode === "packages" &&
                    (attr.code === "code" || attr.code === "name")
                  ) {
                    return null;
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
                        defaultAccountingModelId={defaultAccountingModelId}
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
                    return <AccountingModelFlags key={attr.id} />;
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
                        />
                      ) : attr.type === "enum" ? (
                        <select
                          className={inputClass}
                          name={attr.code}
                          required={attr.required}
                          defaultValue=""
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
                          defaultValue={
                            attr.code === "productId" && presetProductId
                              ? presetProductId
                              : undefined
                          }
                          options={refOptions[attr.code] ?? []}
                          createKind={refCreateKind(attr.refEntityCode)}
                          createLabel={tc("createRef")}
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
                          required={attr.required}
                          step={attr.type === "number" ? "any" : undefined}
                        />
                      )}
                    </Field>
                  );
                })}
                {entityCode === "packages" && section.code === "main" ? (
                  <p className="md:col-span-2 text-xs text-[var(--muted)]">
                    {tCat("packageAutoHint")}
                  </p>
                ) : null}
                {entityCode === "pallets" && section.code === "main" ? (
                  <>
                    <p className="md:col-span-2 text-xs text-[var(--muted)]">
                      {tCat("palletNewHint")}
                    </p>
                    <Field label={`${tc("quantity")} *`}>
                      <input
                        className={inputClass}
                        name="quantity"
                        type="number"
                        min={1}
                        max={500}
                        step={1}
                        required
                        defaultValue={1}
                      />
                    </Field>
                  </>
                ) : null}
              </div>
            </Panel>
          );
        })}
        </div>

        <button className={buttonClass} type="submit">
          {tc("create")}
        </button>
      </form>
    </Page>
  );
}
