import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  DataTable,
  Page,
  PageHeader,
  Panel,
  buttonCompactClass,
  buttonSecondaryClass,
  buttonSecondaryCompactClass,
  inputClass,
} from "@/components/ui";
import { ConfirmForm } from "@/components/confirm-form";
import {
  deleteMetaAttribute,
  moveMetaAttribute,
  updateMetaAttribute,
} from "@/lib/meta/actions";
import { getMetaEntity, listMetaEntities } from "@/lib/meta/catalog";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { resolveLocale } from "@/i18n/config";
import { resolveMetaEntityName } from "@/lib/i18n/seed-labels";
import { hasCapability } from "@/lib/meta/document-registry";
import { loadLineDefinitions } from "@/lib/meta/lines";
import { AddMetaAttributeButton } from "./add-meta-attribute-button";
import { AddMetaLineColumnButton } from "./add-meta-line-column-button";
import { EditCustomMetaEntityForm } from "./edit-custom-meta-entity-form";

export default async function AdminMetaEntityPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  await requireAdmin();
  const locale = resolveLocale(await getLocale());
  const { code } = await params;
  const t = await getTranslations("pages.admin.meta");
  const tc = await getTranslations("pages.common");
  const tSave = await getTranslations("common");
  const entity = await getMetaEntity(code);
  if (!entity) notFound();
  const [all, navSections] = await Promise.all([
    listMetaEntities(),
    prisma.navItem.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { code: true, label: true },
    }),
  ]);
  const sortedAttrs = [...entity.attributes].sort((a, b) => a.order - b.order);
  const isDocument = entity.kind === "document";
  const isCustomDocument = isDocument && entity.storage === "custom";
  const linesEnabled = isCustomDocument && hasCapability(entity, "lines");
  const lineDefs = isCustomDocument ? await loadLineDefinitions(code) : [];
  const lineColumns =
    lineDefs.find((definition) => definition.code === "lines")?.columns ?? [];
  const documentHref = isCustomDocument
    ? `/doc/${code}`
    : isDocument || entity.kind === "journal"
      ? `/doc/${code}`
      : null;

  const addAttributeHint = isDocument
    ? t("addAttrHintDocument")
    : entity.storage === "system"
      ? t("addAttrHintSystem")
      : t("addAttrHintCustom");

  return (
    <Page>
      <PageHeader
        title={resolveMetaEntityName(entity.code, entity.name, locale)}
        description={`${entity.code} · ${entity.storage} · ${entity.kind}`}
        actions={
          <>
            <AddMetaAttributeButton
              entityCode={code}
              hint={addAttributeHint}
              sections={entity.sections.map((s) => ({
                id: s.id,
                code: s.code,
                name: s.name,
              }))}
              entities={all.map((e) => ({ id: e.id, code: e.code }))}
            />
            <Link href="/admin/meta" className={buttonSecondaryClass}>
              {t("toList")}
            </Link>
            {isDocument && documentHref ? (
              <Link href={documentHref} className={buttonSecondaryClass}>
                {t("openDocuments")}
              </Link>
            ) : (
              <Link href={`/catalog/${code}`} className={buttonSecondaryClass}>
                {t("openCatalog")}
              </Link>
            )}
          </>
        }
      />

      {entity.storage === "custom" ? (
        <EditCustomMetaEntityForm entity={entity} navSections={navSections} />
      ) : null}

      {isCustomDocument ? (
        <Panel flush title={t("lineColumns")}>
          <div className="border-b border-[var(--line)] px-4 py-2.5">
            <AddMetaLineColumnButton
              entityCode={code}
              entities={all.map((e) => ({ id: e.id, code: e.code }))}
            />
            {!linesEnabled ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                {t("lineColumnsAuto")}
              </p>
            ) : null}
          </div>
          <DataTable
            headers={[t("attrCode"), t("attrName"), t("type"), t("required")]}
            empty={lineColumns.length === 0 ? t("noLineColumns") : undefined}
          >
            {lineColumns.map((column) => (
              <tr key={column.id}>
                <td className="px-3 py-2 font-mono text-sm">{column.code}</td>
                <td className="px-3 py-2">{column.name}</td>
                <td className="px-3 py-2 text-sm text-[var(--muted)]">
                  {column.type}
                  {column.refEntityCode ? ` → ${column.refEntityCode}` : null}
                </td>
                <td className="px-3 py-2 text-center">
                  {column.required ? tc("yes") : "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      ) : null}

      <Panel flush>
        <DataTable
          colWidths={[
            "8%",
            "19%",
            "12%",
            "10%",
            "7%",
            "7%",
            "7%",
            "10%",
            "20%",
          ]}
          headers={[
            { label: t("attrCode"), title: t("attrCode") },
            { label: t("attrName"), title: t("attrName") },
            { label: t("section"), title: t("section") },
            { label: t("type"), title: t("type") },
            {
              label: t("requiredShort"),
              className: "normal-case text-center",
              title: t("requiredShort"),
            },
            {
              label: t("form"),
              className: "normal-case text-center",
              title: t("form"),
            },
            {
              label: t("list"),
              className: "normal-case text-center",
              title: t("list"),
            },
            {
              label: t("fieldType"),
              className: "normal-case",
              title: t("fieldType"),
            },
            { label: "", title: "" },
          ]}
        >
          {sortedAttrs.map((a, index) => {
            async function saveAttr(formData: FormData) {
              "use server";
              await updateMetaAttribute(code, a.id, formData);
            }
            async function removeAttr() {
              "use server";
              await deleteMetaAttribute(code, a.id);
            }
            async function moveUp() {
              "use server";
              await moveMetaAttribute(code, a.id, "up");
            }
            async function moveDown() {
              "use server";
              await moveMetaAttribute(code, a.id, "down");
            }

            const formId = `meta-attr-${a.id}`;

            return (
              <tr key={a.id} className="align-middle">
                <td className="px-3 py-2 font-mono text-sm whitespace-nowrap">
                  {a.code}
                </td>
                <td className="min-w-0 px-3 py-2">
                  <input
                    form={formId}
                    className={inputClass}
                    name="name"
                    defaultValue={a.name}
                    required
                    aria-label={t("ariaName")}
                  />
                </td>
                <td className="min-w-0 px-3 py-2">
                  <select
                    form={formId}
                    className={inputClass}
                    name="section"
                    defaultValue={a.section?.code ?? "main"}
                    aria-label={t("ariaSection")}
                  >
                    {entity.sections.map((s) => (
                      <option key={s.id} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-sm whitespace-nowrap text-[var(--muted)]">
                  {a.type}
                  {a.refEntityCode ? ` → ${a.refEntityCode}` : null}
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    form={formId}
                    type="checkbox"
                    name="required"
                    className="size-4"
                    defaultChecked={a.required}
                    aria-label={t("ariaRequired")}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    form={formId}
                    type="checkbox"
                    name="formVisible"
                    className="size-4"
                    defaultChecked={a.formVisible}
                    aria-label={t("ariaFormVisible")}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    form={formId}
                    type="checkbox"
                    name="listVisible"
                    className="size-4"
                    defaultChecked={a.listVisible}
                    aria-label={t("ariaListVisible")}
                  />
                </td>
                <td
                  className="px-3 py-2 text-sm whitespace-nowrap text-[var(--muted)]"
                  title={
                    a.systemField || a.isSystem
                      ? t("tooltipSystemField")
                      : t("tooltipExtensionField")
                  }
                >
                  {a.systemField || a.isSystem
                    ? t("systemField")
                    : t("extensionField")}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <form id={formId} action={saveAttr} className="inline">
                      <button className={buttonCompactClass} type="submit">
                        {tSave("save")}
                      </button>
                    </form>
                    <form action={moveUp} className="inline">
                      <button
                        type="submit"
                        className={buttonSecondaryCompactClass}
                        disabled={index === 0}
                        title={tc("moveUp")}
                      >
                        ↑
                      </button>
                    </form>
                    <form action={moveDown} className="inline">
                      <button
                        type="submit"
                        className={buttonSecondaryCompactClass}
                        disabled={index === sortedAttrs.length - 1}
                        title={tc("moveDown")}
                      >
                        ↓
                      </button>
                    </form>
                    {!a.isSystem ? (
                      <ConfirmForm
                        action={removeAttr}
                        className="inline"
                        message={t("deleteAttrConfirm", { name: a.name })}
                      >
                        <button
                          type="submit"
                          className={buttonSecondaryCompactClass}
                        >
                          {tc("delete")}
                        </button>
                      </ConfirmForm>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>
    </Page>
  );
}
