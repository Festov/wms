"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { inputClass } from "@/components/ui";
import {
  CREATE_OPTION_VALUE,
  SHOW_ALL_OPTION_VALUE,
} from "@/lib/create-href";
import {
  QuickCreateDialog,
  type QuickCreateKind,
} from "@/components/quick-create-dialog";
import { ShowAllDialog } from "@/components/show-all-dialog";

type Option = { id: string; label: string; disabled?: boolean };

export function CreateableSelect({
  name,
  options,
  value,
  defaultValue,
  onChange,
  required,
  disabled,
  createKind,
  createDefaults,
  createHref,
  createLabel,
  showAll = true,
  showAllLabel,
  emptyLabel = "—",
  className,
  autoFocus,
  onCreated,
}: {
  name?: string;
  options: Option[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onCreated?: (item: { id: string; label: string; productId?: string }) => void;
  required?: boolean;
  disabled?: boolean;
  /** Быстрое создание во всплывающем окне (без ухода со страницы) */
  createKind?: QuickCreateKind | null;
  createDefaults?: {
    productId?: string;
    counterpartyKind?: "SUPPLIER" | "CUSTOMER" | "BOTH";
  };
  /** Запасной вариант: переход на страницу создания */
  createHref?: string | null;
  createLabel?: string;
  showAll?: boolean;
  showAllLabel?: string;
  emptyLabel?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const t = useTranslations("components.createableSelect");
  const ts = useTranslations("components.shared");
  const router = useRouter();
  const controlled = value !== undefined;
  const [createOpen, setCreateOpen] = useState(false);
  const [showAllOpen, setShowAllOpen] = useState(false);
  const [extraOptions, setExtraOptions] = useState<Option[]>([]);
  const [localValue, setLocalValue] = useState(value ?? defaultValue ?? "");
  const resolvedCreateLabel = createLabel ?? ts("createGeneric");
  const resolvedShowAllLabel = showAllLabel ?? t("showAll");

  useEffect(() => {
    if (value !== undefined) setLocalValue(value);
  }, [value]);

  // Не сбрасываем только что созданные опции при каждом рендере родителя
  // (options часто новый массив по ссылке).
  useEffect(() => {
    setExtraOptions((prev) =>
      prev.filter((p) => !options.some((o) => o.id === p.id)),
    );
  }, [options]);

  const allOptions = useMemo(() => {
    const map = new Map<string, Option>();
    for (const o of options) map.set(o.id, o);
    for (const o of extraOptions) map.set(o.id, o);
    return [...map.values()];
  }, [options, extraOptions]);

  const lotLockedToProduct =
    createKind === "lot" && !createDefaults?.productId?.trim();
  const canCreate =
    Boolean(createKind || createHref) && !lotLockedToProduct && !disabled;
  const canShowAll =
    showAll &&
    !lotLockedToProduct &&
    !disabled &&
    (allOptions.length > 0 || Boolean(createKind));
  const current = controlled ? (value ?? "") : localValue;

  const showAllTitle = createKind
    ? t(`kinds.${createKind}`)
    : t("pickFromList");

  function applyValue(next: string) {
    setLocalValue(next);
    onChange?.(next);
  }

  function rememberOption(item: Option) {
    setExtraOptions((prev) => {
      if (prev.some((p) => p.id === item.id) || options.some((p) => p.id === item.id)) {
        return prev;
      }
      return [...prev, item];
    });
  }

  function handleChange(next: string) {
    if (next === CREATE_OPTION_VALUE) {
      if (createKind) {
        setCreateOpen(true);
        return;
      }
      if (createHref) {
        router.push(createHref);
        return;
      }
      return;
    }
    if (next === SHOW_ALL_OPTION_VALUE) {
      setShowAllOpen(true);
      return;
    }
    applyValue(next);
  }

  return (
    <>
      <select
        className={className ?? inputClass}
        name={name}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        value={current}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {allOptions.map((o) => (
          <option key={o.id} value={o.id} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {canShowAll ? (
          <option value={SHOW_ALL_OPTION_VALUE}>{resolvedShowAllLabel}</option>
        ) : null}
        {canCreate ? (
          <option value={CREATE_OPTION_VALUE}>{resolvedCreateLabel}</option>
        ) : null}
      </select>

      {canShowAll ? (
        <ShowAllDialog
          open={showAllOpen}
          title={showAllTitle}
          options={allOptions}
          createKind={createKind}
          productId={createDefaults?.productId}
          counterpartyKind={createDefaults?.counterpartyKind}
          selectedId={current}
          onClose={() => setShowAllOpen(false)}
          onSelect={(item) => {
            rememberOption(item);
            applyValue(item.id);
          }}
        />
      ) : null}

      {createKind ? (
        <QuickCreateDialog
          kind={createKind}
          open={createOpen}
          defaults={createDefaults}
          onClose={() => setCreateOpen(false)}
          onCreated={(item) => {
            if (
              createKind === "lot" &&
              createDefaults?.productId &&
              item.productId &&
              item.productId !== createDefaults.productId
            ) {
              return;
            }
            rememberOption(item);
            applyValue(item.id);
            onCreated?.(item);
          }}
        />
      ) : null}
    </>
  );
}
