"use client";

import {
  Field,
  Panel,
  inputClass,
} from "@/components/ui";
import { CreateableSelect } from "@/components/createable-select";
import { enumLabel } from "@/lib/format";
import { refCreateKind } from "@/lib/meta/ref-create";
import { useTranslations } from "next-intl";

export type ExtraFieldAttr = {
  id: string;
  code: string;
  name: string;
  type: string;
  required: boolean;
  enumValues: string | null;
  refEntityCode: string | null;
  section: { name: string } | null;
};

export function DocumentExtraFields({
  attributes,
  refOptions = {},
  values = {},
  title,
}: {
  attributes: ExtraFieldAttr[];
  refOptions?: Record<string, { id: string; label: string }[]>;
  values?: Record<string, unknown>;
  title?: string;
}) {
  const ts = useTranslations("components.shared");
  const t = useTranslations("components.documentExtraFields");
  const resolvedTitle = title ?? ts("extraDetails");

  if (attributes.length === 0) return null;

  const bySection = new Map<string, ExtraFieldAttr[]>();
  for (const attr of attributes) {
    const key = attr.section?.name ?? resolvedTitle;
    const list = bySection.get(key) ?? [];
    list.push(attr);
    bySection.set(key, list);
  }

  return (
    <>
      {[...bySection.entries()].map(([sectionName, attrs]) => (
        <Panel key={sectionName} title={sectionName}>
          <div className="grid gap-3 md:grid-cols-2">
            {attrs.map((attr) => {
              const raw = values[attr.code];
              const defaultValue =
                raw == null || raw === ""
                  ? ""
                  : typeof raw === "boolean"
                    ? raw
                      ? "true"
                      : ""
                    : String(raw);

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
                    />
                  ) : attr.type === "enum" ? (
                    <select
                      className={inputClass}
                      name={attr.code}
                      required={attr.required}
                      defaultValue={defaultValue as string}
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
                      defaultValue={defaultValue as string}
                      options={refOptions[attr.code] ?? []}
                      createKind={refCreateKind(attr.refEntityCode)}
                      createLabel={t("createLabel")}
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
                      defaultValue={
                        typeof defaultValue === "boolean"
                          ? ""
                          : defaultValue
                      }
                      step={attr.type === "number" ? "any" : undefined}
                    />
                  )}
                </Field>
              );
            })}
          </div>
        </Panel>
      ))}
    </>
  );
}
