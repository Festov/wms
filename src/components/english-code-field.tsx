"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Field, inputClass } from "@/components/ui";
import { sanitizeEntityCode } from "@/lib/entity-code";

type EnglishCodeFieldProps = {
  name?: string;
  label?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onCodeChange?: (code: string) => void;
};

export function EnglishCodeField({
  name = "code",
  label,
  value: controlledValue,
  defaultValue = "",
  placeholder = "brands",
  required = true,
  disabled = false,
  onCodeChange,
}: EnglishCodeFieldProps) {
  const t = useTranslations("components.englishCodeField");
  const [internal, setInternal] = useState(defaultValue);
  const code = controlledValue ?? internal;
  const resolvedLabel = label ?? t("label");

  function handleChange(nextRaw: string) {
    const next = sanitizeEntityCode(nextRaw);
    if (controlledValue === undefined) setInternal(next);
    onCodeChange?.(next);
  }

  return (
    <Field label={resolvedLabel}>
      <input
        className={inputClass}
        name={name}
        value={code}
        onChange={(e) => handleChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        pattern="[a-z][a-z0-9_]*"
        title={t("title")}
      />
      <p className="mt-1 text-xs text-[var(--muted)]">{t("hint")}</p>
    </Field>
  );
}
