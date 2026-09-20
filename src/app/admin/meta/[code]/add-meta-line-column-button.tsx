"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Field,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { addMetaLineColumn } from "@/lib/meta/actions";

type EntityOption = { id: string; code: string };

const FIELD_TYPES = ["string", "number", "bool", "date", "ref"] as const;

export function AddMetaLineColumnButton({
  entityCode,
  entities,
}: {
  entityCode: string;
  entities: EntityOption[];
}) {
  const t = useTranslations("dialogs.admin.meta.addLineColumn");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={buttonClass}
        onClick={() => setOpen(true)}
      >
        {t("createButton")}
      </button>
      <AddMetaLineColumnDialog
        open={open}
        entityCode={entityCode}
        entities={entities}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function AddMetaLineColumnDialog({
  open,
  onClose,
  entityCode,
  entities,
}: {
  open: boolean;
  onClose: () => void;
  entityCode: string;
  entities: EntityOption[];
}) {
  const t = useTranslations("dialogs.admin.meta.addLineColumn");
  const tc = useTranslations("common");
  const tp = useTranslations("pages.common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("string");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setType("string");
  }, [open]);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addMetaLineColumn(entityCode, formData);
        onClose();
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : tp("saveError"),
        );
      }
    });
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h3 className="text-sm font-semibold">{t("title")}</h3>
        </div>
        <form action={submit} className="space-y-3 p-4">
          <Field label={t("code")}>
            <input
              className={inputClass}
              name="code"
              required
              placeholder="amount"
              disabled={pending}
            />
          </Field>
          <Field label={t("name")}>
            <input
              className={inputClass}
              name="name"
              required
              placeholder={t("namePlaceholder")}
              disabled={pending}
            />
          </Field>
          <Field label={t("type")}>
            <select
              className={inputClass}
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={pending}
            >
              {FIELD_TYPES.map((fieldType) => (
                <option key={fieldType} value={fieldType}>
                  {t(`fieldTypes.${fieldType}`)}
                </option>
              ))}
            </select>
          </Field>
          {type === "ref" ? (
            <Field label={t("refEntity")}>
              <select
                className={inputClass}
                name="refEntityCode"
                required
                disabled={pending}
              >
                <option value="">{t("selectRef")}</option>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.code}>
                    {entity.code}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="required" className="size-4" />
            {t("required")}
          </label>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className={buttonSecondaryClass}
              onClick={onClose}
              disabled={pending}
            >
              {tc("cancel")}
            </button>
            <button className={buttonClass} type="submit" disabled={pending}>
              {pending ? tp("saving") : t("add")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
