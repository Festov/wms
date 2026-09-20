"use client";

import { Field, Panel, inputClass } from "@/components/ui";
import { MetaFormField } from "@/components/meta-form-field";
import {
  inboundFieldInputClass,
  inboundFieldLabelClass,
  inboundFieldValueClass,
} from "@/lib/inbound-field-styles";
import {
  resolveMetaFieldName,
  type MetaFieldContext,
  type MetaFormAttr,
} from "@/lib/meta/widgets";
import type { DocumentEntityCode } from "@/lib/meta/document-form-shared";

export type MetaRecordSection = {
  code: string;
  name: string;
  id?: string;
  attributes: MetaFormAttr[];
};

type RefOption = { id: string; label: string };

export function MetaFormSections({
  sections,
  values,
  entityCode,
  context = {},
  refOptions = {},
  disabled = false,
  layout,
  onFieldChange,
}: {
  sections: MetaRecordSection[];
  values: Record<string, unknown>;
  entityCode?: string | DocumentEntityCode;
  context?: MetaFieldContext;
  refOptions?: Record<string, RefOption[]>;
  disabled?: boolean;
  layout: "form" | "panels" | "compact";
  onFieldChange?: (name: string, value: string) => void;
}) {
  const fieldInputClass =
    layout === "compact" ? inboundFieldInputClass : inputClass;

  const renderAttribute = (attr: MetaFormAttr) => {
    const name = resolveMetaFieldName(attr, entityCode);
    const value = values[name] ?? values[attr.code];
    const wide = attr.code === "notes";

    if (layout === "compact") {
      return (
        <div key={attr.id} className={wide ? "sm:col-span-2" : undefined}>
          <dt className={inboundFieldLabelClass}>{attr.name}</dt>
          <dd className={inboundFieldValueClass}>
            <MetaFormField
              attr={attr}
              value={value}
              entityCode={entityCode}
              context={context}
              refOptions={refOptions}
              inputClass={fieldInputClass}
              disabled={disabled}
              onChange={onFieldChange}
            />
          </dd>
        </div>
      );
    }

    return (
      <Field
        key={attr.id}
        label={`${attr.name}${attr.required ? " *" : ""}`}
        className={wide ? "md:col-span-2" : undefined}
      >
        <MetaFormField
          attr={attr}
          value={value}
          entityCode={entityCode}
          context={context}
          refOptions={refOptions}
          inputClass={fieldInputClass}
          disabled={disabled}
          onChange={onFieldChange}
        />
      </Field>
    );
  };

  if (layout === "panels") {
    return (
      <>
        {sections.map((section) => {
          if (section.attributes.length === 0) return null;
          return (
            <Panel key={section.id ?? section.code} title={section.name}>
              <div className="grid gap-3 md:grid-cols-2">
                {section.attributes.map(renderAttribute)}
              </div>
            </Panel>
          );
        })}
      </>
    );
  }

  if (layout === "form") {
    return (
      <>
        {sections.map((section) => (
          <div key={section.code} className="grid gap-3 md:grid-cols-2">
            {section.attributes.map(renderAttribute)}
          </div>
        ))}
      </>
    );
  }

  return <>{sections.flatMap((s) => s.attributes.map(renderAttribute))}</>;
}
