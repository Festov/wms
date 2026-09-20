"use client";

import { useTranslations } from "next-intl";
import { CreateableSelect } from "@/components/createable-select";
import { enumLabel } from "@/lib/format";
import {
  enumOptionsForAttr,
  type DocumentEntityCode,
} from "@/lib/meta/document-form-shared";
import { refCreateKind } from "@/lib/meta/ref-create";
import {
  isSystemDocumentEntityCode,
  resolveMetaFieldName,
  resolveMetaFieldWidget,
  type MetaFieldContext,
  type MetaFormAttr,
} from "@/lib/meta/widgets";

type RefOption = { id: string; label: string };

export function MetaFormField({
  attr,
  value,
  entityCode,
  context = {},
  refOptions = {},
  inputClass,
  disabled = false,
  onChange,
}: {
  attr: MetaFormAttr;
  value: unknown;
  entityCode?: string | DocumentEntityCode;
  context?: MetaFieldContext;
  refOptions?: Record<string, RefOption[]>;
  inputClass: string;
  disabled?: boolean;
  onChange?: (name: string, value: string) => void;
}) {
  const t = useTranslations("components.metaFormField");
  const ts = useTranslations("components.shared");
  const name = resolveMetaFieldName(attr, entityCode);
  const strValue = value == null ? "" : String(value);
  const widget = resolveMetaFieldWidget(attr, entityCode);

  if (widget === "readonly") {
    return (
      <input
        className={`${inputClass} bg-[var(--surface)] text-[var(--ink)]`}
        value={strValue}
        readOnly
        tabIndex={-1}
      />
    );
  }

  if (widget === "counterparty_supplier") {
    return (
      <CreateableSelect
        name={name}
        value={strValue}
        disabled={disabled}
        required={attr.required}
        emptyLabel={t("selectCounterparty")}
        createKind="counterparty"
        createDefaults={{ counterpartyKind: "SUPPLIER" }}
        createLabel={t("createCounterparty")}
        options={context.counterparties ?? []}
        className={inputClass}
        onChange={(id) => onChange?.(name, id)}
        onCreated={(item) => onChange?.(name, item.id)}
      />
    );
  }

  if (widget === "counterparty_customer") {
    return (
      <CreateableSelect
        name={name}
        value={strValue}
        disabled={disabled}
        required={attr.required}
        emptyLabel={t("selectCounterparty")}
        createKind="counterparty"
        createDefaults={{ counterpartyKind: "CUSTOMER" }}
        createLabel={t("createCounterparty")}
        options={context.counterparties ?? []}
        className={inputClass}
        onChange={(id) => onChange?.(name, id)}
        onCreated={(item) => onChange?.(name, item.id)}
      />
    );
  }

  if (widget === "receivingDock") {
    return (
      <CreateableSelect
        name={name}
        value={strValue}
        disabled={disabled}
        createKind="receivingDock"
        createLabel={t("createDock")}
        emptyLabel={t("dockNotSelected")}
        showAll={false}
        options={context.docks ?? []}
        className={inputClass}
        onChange={(id) => onChange?.(name, id)}
        onCreated={(item) => onChange?.(name, item.id)}
      />
    );
  }

  if (widget === "transportUnit") {
    return (
      <CreateableSelect
        name={name}
        value={strValue}
        disabled={disabled}
        createKind="transportUnit"
        createLabel={t("createTransport")}
        emptyLabel={t("transportNotSelected")}
        showAll={false}
        options={context.transportUnits ?? []}
        className={inputClass}
        onChange={(id) => onChange?.(name, id)}
        onCreated={(item) => onChange?.(name, item.id)}
      />
    );
  }

  if (attr.type === "enum") {
    const options = isSystemDocumentEntityCode(entityCode)
      ? enumOptionsForAttr(entityCode, attr)
      : (attr.enumValues ? (JSON.parse(attr.enumValues) as string[]) : []).map(
          (option) => ({ value: option, label: enumLabel(option) }),
        );
    return (
      <select
        className={inputClass}
        name={name}
        defaultValue={strValue}
        disabled={disabled}
        required={attr.required}
        onChange={(e) => {
          onChange?.(name, e.target.value);
          if (onChange) e.currentTarget.form?.requestSubmit();
        }}
      >
        {!attr.required ? <option value="">—</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (attr.type === "bool") {
    return (
      <input
        type="checkbox"
        name={name}
        className="size-4"
        defaultChecked={Boolean(value)}
        disabled={disabled}
        onChange={() => onChange?.(name, "1")}
      />
    );
  }

  if (attr.type === "date") {
    return (
      <input
        className={inputClass}
        type="date"
        name={name}
        defaultValue={strValue}
        disabled={disabled}
        required={attr.required}
        onChange={(e) => {
          onChange?.(name, e.target.value);
          if (onChange) e.currentTarget.form?.requestSubmit();
        }}
      />
    );
  }

  if (attr.type === "ref" && attr.refEntityCode) {
    const options =
      context.extraRefOptions?.[attr.code] ??
      refOptions[attr.code] ??
      [];
    return (
      <CreateableSelect
        name={name}
        value={strValue}
        defaultValue={strValue}
        disabled={disabled}
        required={attr.required}
        options={options}
        createKind={refCreateKind(attr.refEntityCode)}
        createLabel={ts("createGeneric")}
        className={inputClass}
        onChange={(id) => onChange?.(name, id)}
        onCreated={(item) => onChange?.(name, item.id)}
      />
    );
  }

  if (attr.type === "number") {
    return (
      <input
        className={inputClass}
        type="number"
        step="any"
        name={name}
        defaultValue={strValue}
        disabled={disabled}
        required={attr.required}
        onBlur={(e) => onChange?.(name, e.target.value)}
      />
    );
  }

  return (
    <input
      className={inputClass}
      name={name}
      defaultValue={strValue}
      disabled={disabled}
      required={attr.required}
      onBlur={(e) => onChange?.(name, e.target.value)}
    />
  );
}
