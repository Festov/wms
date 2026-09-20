import { getTranslations } from "next-intl/server";
import {
  Field,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { updateCustomMetaEntity } from "@/lib/meta/actions";
import { parseCapabilities } from "@/lib/meta/types";
import {
  catalogNavHref,
  documentNavHref,
} from "@/lib/nav/helpers";

type NavSectionOption = { code: string; label: string };

type EntityForEdit = {
  code: string;
  name: string;
  pluralName: string | null;
  description: string | null;
  kind: string;
  navItemCode: string | null;
  capabilities: string | null;
};

export async function EditCustomMetaEntityForm({
  entity,
  navSections,
}: {
  entity: EntityForEdit;
  navSections: NavSectionOption[];
}) {
  const t = await getTranslations("dialogs.admin.meta.editEntity");
  const tp = await getTranslations("pages.common");
  const isDocument = entity.kind === "document";
  const capabilities = parseCapabilities(entity.capabilities);
  const linesEnabled = isDocument && capabilities.includes("lines");
  const workflowEnabled = isDocument && capabilities.includes("workflow");
  const publicHref = isDocument
    ? documentNavHref(entity.code)
    : catalogNavHref(entity.code);

  return (
    <Panel>
      <form action={updateCustomMetaEntity} className="space-y-3">
        <input type="hidden" name="code" value={entity.code} />

        <Field label={t("code")}>
          <p className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-sm">
            {entity.code}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {t("codeHint", { href: publicHref })}
          </p>
        </Field>

        <Field label={t("name")}>
          <input
            className={inputClass}
            name="name"
            required
            defaultValue={entity.name}
          />
        </Field>

        <Field label={t("pluralName")}>
          <input
            className={inputClass}
            name="pluralName"
            defaultValue={entity.pluralName ?? ""}
            placeholder={entity.name}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            {t("pluralNameHint")}
          </p>
        </Field>

        <Field label={t("description")}>
          <input
            className={inputClass}
            name="description"
            defaultValue={entity.description ?? ""}
            placeholder={
              isDocument
                ? t("descriptionDocumentPlaceholder")
                : t("descriptionEntityPlaceholder")
            }
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            {t("descriptionHint")}
          </p>
        </Field>

        <Field label={t("navSection")}>
          <select
            className={inputClass}
            name="navItemCode"
            defaultValue={entity.navItemCode ?? ""}
          >
            <option value="">{tp("nsi")}</option>
            {navSections.map((section) => (
              <option key={section.code} value={section.code}>
                {section.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {isDocument ? t("navSectionHintDocument") : t("navSectionHintEntity")}
          </p>
        </Field>

        {isDocument ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="withLines"
                className="size-4"
                defaultChecked={linesEnabled}
              />
              {t("withLines")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="withWorkflow"
                className="size-4"
                defaultChecked={workflowEnabled}
              />
              {t("withWorkflow")}
            </label>
          </div>
        ) : null}

        <div className="flex justify-end pt-1">
          <button className={buttonClass} type="submit">
            {t("saveProperties")}
          </button>
        </div>
      </form>
    </Panel>
  );
}
