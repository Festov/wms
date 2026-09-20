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
import { addMetaAttribute } from "@/lib/meta/actions";

type SectionOption = { id: string; code: string; name: string };
type EntityOption = { id: string; code: string };

const FIELD_TYPES = ["string", "number", "bool", "date", "enum", "ref"] as const;

export function AddMetaAttributeButton({
  entityCode,
  hint,
  sections,
  entities,
}: {
  entityCode: string;
  hint: string;
  sections: SectionOption[];
  entities: EntityOption[];
}) {
  const t = useTranslations("dialogs.admin.meta.addAttribute");
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
      <AddMetaAttributeDialog
        open={open}
        entityCode={entityCode}
        hint={hint}
        sections={sections}
        entities={entities}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function AddMetaAttributeDialog({
  open,
  onClose,
  entityCode,
  hint,
  sections,
  entities,
}: {
  open: boolean;
  onClose: () => void;
  entityCode: string;
  hint: string;
  sections: SectionOption[];
  entities: EntityOption[];
}) {
  const t = useTranslations("dialogs.admin.meta.addAttribute");
  const tField = useTranslations("pages.admin.statuses");
  const tc = useTranslations("common");
  const tp = useTranslations("pages.common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultSection =
    sections.find((s) => s.code === "main")?.code ?? sections[0]?.code ?? "main";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
  }, [open]);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addMetaAttribute(entityCode, formData);
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
      aria-labelledby="add-meta-attr-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h3 id="add-meta-attr-title" className="text-sm font-semibold">
            {t("title")}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>
        </div>
        <form action={submit} className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("code")}>
              <input
                className={inputClass}
                name="code"
                required
                placeholder="brand"
                autoFocus
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
            <Field label={t("section")}>
              <select
                className={inputClass}
                name="section"
                defaultValue={defaultSection}
                disabled={pending}
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("type")}>
              <select
                className={inputClass}
                name="type"
                defaultValue="string"
                disabled={pending}
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {tField(`fieldTypes.${type}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("refEntity")}>
              <select
                className={inputClass}
                name="refEntityCode"
                defaultValue=""
                disabled={pending}
              >
                <option value="">—</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.code}>
                    {e.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("enumValues")}>
              <input
                className={inputClass}
                name="enumValues"
                placeholder="A, B, C"
                disabled={pending}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="required"
                className="size-4"
                disabled={pending}
              />
              {t("required")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="formVisible"
                className="size-4"
                defaultChecked
                disabled={pending}
              />
              {t("formVisible")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="listVisible"
                className="size-4"
                defaultChecked
                disabled={pending}
              />
              {t("listVisible")}
            </label>
          </div>

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
              {pending ? tp("adding") : t("add")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
