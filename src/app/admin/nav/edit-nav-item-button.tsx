"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EnglishCodeField } from "@/components/english-code-field";
import {
  Field,
  buttonClass,
  buttonSecondaryClass,
  buttonSecondaryCompactClass,
  inputClass,
} from "@/components/ui";
import { updateNavItem } from "@/lib/nav/actions";
import { entityCodeFromNavItemCode, navHubHref } from "@/lib/nav/helpers";

export function EditNavItemButton({
  navItemId,
  itemKey,
  initialLabel,
  iconKey,
  isActive: initialIsActive,
}: {
  navItemId: string;
  itemKey: string;
  initialLabel: string;
  iconKey: string;
  isActive: boolean;
}) {
  const tp = useTranslations("pages.common");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={buttonSecondaryCompactClass}
        onClick={() => setOpen(true)}
      >
        {tp("edit")}
      </button>
      <EditNavItemDialog
        open={open}
        onClose={() => setOpen(false)}
        navItemId={navItemId}
        itemKey={itemKey}
        initialLabel={initialLabel}
        iconKey={iconKey}
        initialIsActive={initialIsActive}
      />
    </>
  );
}

function EditNavItemDialog({
  open,
  onClose,
  navItemId,
  itemKey,
  initialLabel,
  iconKey,
  initialIsActive,
}: {
  open: boolean;
  onClose: () => void;
  navItemId: string;
  itemKey: string;
  initialLabel: string;
  iconKey: string;
  initialIsActive: boolean;
}) {
  const t = useTranslations("dialogs.admin.nav");
  const tc = useTranslations("common");
  const tp = useTranslations("pages.common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState(initialLabel);
  const [code, setCode] = useState(entityCodeFromNavItemCode(itemKey));
  const [isActive, setIsActive] = useState(initialIsActive);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLabel(initialLabel);
    setCode(entityCodeFromNavItemCode(itemKey));
    setIsActive(initialIsActive);
  }, [open, initialLabel, itemKey, initialIsActive]);

  function submit(formData: FormData) {
    setError(null);
    formData.set("label", label);
    formData.set("code", code);
    formData.set("iconKey", iconKey);
    if (isActive) formData.set("isActive", "on");
    startTransition(async () => {
      try {
        await updateNavItem(navItemId, formData);
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
      aria-labelledby="edit-nav-item-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h3 id="edit-nav-item-title" className="text-sm font-semibold">
            {t("editTitle")}
          </h3>
        </div>
        <form action={submit} className="space-y-3 p-4">
          <Field label={t("menuLabel")}>
            <input
              className={inputClass}
              name="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              disabled={pending}
            />
          </Field>

          <EnglishCodeField
            value={code}
            onCodeChange={setCode}
            disabled={pending}
            label={t("sectionCode")}
          />

          <Field label={t("link")}>
            <p className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-sm">
              {code ? navHubHref(code) : "—"}
            </p>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-3.5"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={pending}
            />
            {t("active")}
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
            <button
              className={buttonClass}
              type="submit"
              disabled={pending || !label.trim() || !code.trim()}
            >
              {pending ? tp("saving") : tc("save")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
