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
import { createStatus } from "@/lib/admin-actions";

export function CreateStatusButton() {
  const t = useTranslations("dialogs.admin.statuses");
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
      <CreateStatusDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function CreateStatusDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("dialogs.admin.statuses");
  const tc = useTranslations("common");
  const tp = useTranslations("pages.common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        await createStatus(formData);
        onClose();
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : tp("createError"),
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
      aria-labelledby="create-status-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h3 id="create-status-title" className="text-sm font-semibold">
            {t("title")}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {t("description")}
          </p>
        </div>
        <form action={submit} className="space-y-3 p-4">
          <Field label={t("code")}>
            <input
              className={inputClass}
              name="code"
              required
              placeholder="ON_HOLD"
              pattern="[A-Za-z][A-Za-z0-9_]*"
              disabled={pending}
              autoFocus
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
              {pending ? tp("creating") : tp("create")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
