"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EnglishCodeField } from "@/components/english-code-field";
import { ICON_KEYS } from "@/components/icons";
import {
  Field,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { navHubHref } from "@/lib/nav/helpers";
import { createNavItem } from "@/lib/nav/actions";

export function CreateNavItemButton() {
  const t = useTranslations("dialogs.admin.nav");
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
      <CreateNavItemDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function CreateNavItemDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("dialogs.admin.nav");
  const tc = useTranslations("common");
  const tp = useTranslations("pages.common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCode("");
    setLabel("");
  }, [open]);

  const hrefPreview = code ? navHubHref(code) : null;

  function submit(formData: FormData) {
    setError(null);
    formData.set("code", code);
    formData.set("label", label);
    startTransition(async () => {
      try {
        await createNavItem(formData);
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
      aria-labelledby="create-nav-item-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h3 id="create-nav-item-title" className="text-sm font-semibold">
            {t("createTitle")}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {t("createDescription")}
          </p>
        </div>
        <form action={submit} className="space-y-3 p-4">
          <EnglishCodeField
            value={code}
            onCodeChange={setCode}
            disabled={pending}
            placeholder="partners"
            label={t("sectionCode")}
          />

          <Field label={t("menuLabel")}>
            <input
              className={inputClass}
              name="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              placeholder={t("menuLabelPlaceholder")}
              disabled={pending}
              autoFocus
            />
          </Field>

          <Field label={t("link")}>
            <p className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-sm">
              {hrefPreview ?? "—"}
            </p>
          </Field>

          <Field label={t("icon")}>
            <select
              className={inputClass}
              name="iconKey"
              defaultValue="book"
              disabled={pending}
            >
              {ICON_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>

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
              disabled={pending || !code || !label}
            >
              {pending ? tp("creating") : tp("create")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
