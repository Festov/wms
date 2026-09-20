"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { MetaFormSections, type MetaRecordSection } from "@/components/meta-form-sections";
import {
  type MetaFieldContext,
  type MetaFormAttr,
} from "@/lib/meta/widgets";
import type { DocumentEntityCode } from "@/lib/meta/document-form-shared";
import type { MetaEntityFull } from "@/lib/meta/catalog";

export type { MetaRecordSection, MetaFieldContext, MetaFormAttr };

type RefOption = { id: string; label: string };

export function buildMetaRecordSections(
  entity: Pick<MetaEntityFull, "attributes">,
  sections: MetaEntityFull["sections"],
  labels?: { mainSection?: string },
): MetaRecordSection[] {
  const resolvedSections =
    sections.length > 0
      ? sections
      : [{ id: "_main", code: "main", name: labels?.mainSection ?? "main", order: 0, entityId: "" }];

  return resolvedSections
    .map((section) => ({
      code: section.code,
      name: section.name,
      id: section.id,
      attributes: entity.attributes.filter((attr) => {
        if (attr.formVisible === false) return false;
        if (attr.sectionId) return attr.sectionId === section.id;
        return section.code === "main";
      }),
    }))
    .filter((section) => section.attributes.length > 0);
}

export function MetaRecordFields({
  sections,
  values = {},
  entityCode,
  context = {},
  refOptions = {},
  disabled = false,
  layout = "panels",
  formId,
  onSave,
}: {
  sections: MetaRecordSection[];
  values?: Record<string, unknown>;
  entityCode?: string | DocumentEntityCode;
  context?: MetaFieldContext;
  refOptions?: Record<string, RefOption[]>;
  disabled?: boolean;
  layout?: "compact" | "form" | "panels";
  formId?: string;
  onSave?: (formData: FormData) => Promise<void>;
}) {
  const [, startTransition] = useTransition();
  const [localValues, setLocalValues] = useState(values);
  const [lastSnapshot, setLastSnapshot] = useState(() => JSON.stringify(values));

  const mergedValues = { ...values, ...localValues };

  const handleChange = useCallback(
    (name: string, value: string) => {
      if (disabled || !onSave || !formId) return;
      setLocalValues((prev) => ({ ...prev, [name]: value }));
      const form = document.getElementById(formId) as HTMLFormElement | null;
      if (!form) return;
      const fd = new FormData(form);
      fd.set(name, value);
      const snapshot = JSON.stringify(Object.fromEntries(fd.entries()));
      if (snapshot === lastSnapshot) return;
      setLastSnapshot(snapshot);
      startTransition(async () => {
        await onSave(fd);
      });
    },
    [disabled, formId, lastSnapshot, onSave],
  );

  const onFieldChange = layout === "compact" && onSave ? handleChange : undefined;

  const content = (
    <MetaFormSections
      sections={sections}
      values={mergedValues}
      entityCode={entityCode}
      context={context}
      refOptions={refOptions}
      disabled={disabled}
      layout={layout}
      onFieldChange={onFieldChange}
    />
  );

  if (layout !== "compact") {
    return content;
  }

  return (
    <form
      id={formId}
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        if (!onSave) return;
        startTransition(async () => {
          await onSave(new FormData(e.currentTarget));
        });
      }}
    >
      {content}
    </form>
  );
}

/** @deprecated Use MetaRecordFields with entityCode */
export function MetaDocumentFields({
  entityCode,
  sections,
  values,
  context,
  disabled,
  layout = "compact",
  formId,
  onSave,
}: {
  entityCode: DocumentEntityCode;
  sections: MetaRecordSection[];
  values: Record<string, unknown>;
  context: MetaFieldContext;
  disabled?: boolean;
  layout?: "compact" | "form";
  formId?: string;
  onSave?: (formData: FormData) => Promise<void>;
}) {
  return (
    <MetaRecordFields
      entityCode={entityCode}
      sections={sections}
      values={values}
      context={context}
      disabled={disabled}
      layout={layout}
      formId={formId}
      onSave={onSave}
    />
  );
}

/** @deprecated Use MetaRecordFields with layout="panels" */
export function CustomMetaRecordFields({
  entity,
  sections,
  refOptions,
  row,
}: {
  entity: MetaEntityFull;
  sections: MetaEntityFull["sections"];
  refOptions: Record<string, RefOption[]>;
  row?: Record<string, unknown>;
}) {
  const t = useTranslations("components.metaRecord");
  const recordSections = useMemo(
    () =>
      buildMetaRecordSections(entity, sections, {
        mainSection: t("mainSection"),
      }),
    [entity, sections, t],
  );

  return (
    <MetaRecordFields
      sections={recordSections}
      values={row}
      refOptions={refOptions}
      layout="panels"
    />
  );
}
