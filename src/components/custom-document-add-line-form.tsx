"use client";

import { useTranslations } from "next-intl";
import {
  Field,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { CreateableSelect } from "@/components/createable-select";
import type { MetaLineColumn } from "@/generated/prisma/client";

type RefOption = { id: string; label: string };

function defaultInputValue(
  col: MetaLineColumn,
  values?: Record<string, unknown>,
): string {
  if (!values) return "";
  const raw = values[col.code];
  if (raw == null) return "";
  if (typeof raw === "boolean") return raw ? "true" : "";
  return String(raw);
}

export function CustomDocumentAddLineForm({
  action,
  columns,
  refOptions = {},
  values,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  columns: MetaLineColumn[];
  refOptions?: Record<string, RefOption[]>;
  values?: Record<string, unknown>;
  submitLabel?: string;
}) {
  const t = useTranslations("components.shared");

  return (
    <Panel title={t("lineDetails")}>
      <form action={action} className="grid gap-3 md:grid-cols-2">
        {columns.map((col) => {
          const current = values?.[col.code];
          return (
            <Field
              key={col.id}
              label={`${col.name}${col.required ? " *" : ""}`}
              className={col.type === "string" ? "md:col-span-2" : undefined}
            >
              {col.type === "bool" ? (
                <input
                  type="checkbox"
                  name={col.code}
                  className="size-4"
                  defaultChecked={
                    current === true ||
                    current === "on" ||
                    current === "true" ||
                    current === 1
                  }
                />
              ) : col.type === "enum" ? (
                <input
                  className={inputClass}
                  name={col.code}
                  required={col.required}
                  defaultValue={defaultInputValue(col, values)}
                />
              ) : col.type === "ref" && col.refEntityCode ? (
                <CreateableSelect
                  name={col.code}
                  required={col.required}
                  options={refOptions[col.code] ?? []}
                  createLabel={t("createGeneric")}
                  defaultValue={
                    typeof current === "string" ? current : undefined
                  }
                />
              ) : (
                <input
                  className={inputClass}
                  name={col.code}
                  type={
                    col.type === "number"
                      ? "number"
                      : col.type === "date"
                        ? "date"
                        : "text"
                  }
                  step={col.type === "number" ? "any" : undefined}
                  required={col.required}
                  defaultValue={defaultInputValue(col, values)}
                />
              )}
            </Field>
          );
        })}
        <div className="flex items-end md:col-span-2">
          <button className={buttonClass} type="submit">
            {submitLabel ?? t("add")}
          </button>
        </div>
      </form>
    </Panel>
  );
}
