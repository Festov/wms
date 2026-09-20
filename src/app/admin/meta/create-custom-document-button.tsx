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
  inputClass,
} from "@/components/ui";
import { createCustomDocument } from "@/lib/meta/actions";

type NavSectionOption = { code: string; label: string };

export function CreateCustomDocumentButton({
  navSections,
}: {
  navSections: NavSectionOption[];
}) {
  const t = useTranslations("dialogs.admin.meta");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={buttonClass}
        onClick={() => setOpen(true)}
      >
        {t("createDocumentButton")}
      </button>
      <CreateCustomDocumentDialog
        open={open}
        onClose={() => setOpen(false)}
        navSections={navSections}
      />
    </>
  );
}

function CreateCustomDocumentDialog({
  open,
  onClose,
  navSections,
}: {
  open: boolean;
  onClose: () => void;
  navSections: NavSectionOption[];
}) {
  const t = useTranslations("dialogs.admin.meta");
  const tc = useTranslations("common");
  const tp = useTranslations("pages.common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [navItemCode, setNavItemCode] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCode("");
    setNavItemCode(navSections[0]?.code ?? "");
  }, [open, navSections]);

  function submit(formData: FormData) {
    setError(null);
    formData.set("code", code);
    formData.set("navItemCode", navItemCode);
    startTransition(async () => {
      try {
        const { code: entityCode } = await createCustomDocument(formData);
        onClose();
        router.push(`/admin/meta/${entityCode}`);
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
      aria-labelledby="create-custom-document-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h3 id="create-custom-document-title" className="text-sm font-semibold">
            {t("createDocumentTitle")}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {t("createDocumentDescription")}
          </p>
        </div>
        <form action={submit} className="space-y-3 p-4">
          <EnglishCodeField
            value={code}
            onCodeChange={setCode}
            disabled={pending}
            placeholder="requests"
          />

          <Field label={t("name")}>
            <input
              className={inputClass}
              name="name"
              required
              placeholder={t("nameDocumentPlaceholder")}
              disabled={pending}
              autoFocus
            />
          </Field>

          <Field label={t("pluralName")}>
            <input
              className={inputClass}
              name="pluralName"
              placeholder={t("pluralNameDocumentPlaceholder")}
              disabled={pending}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              {t("pluralNameDocumentHint")}
            </p>
          </Field>

          <Field label={t("description")}>
            <input
              className={inputClass}
              name="description"
              placeholder={t("descriptionDocumentPlaceholder")}
              disabled={pending}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              {t("descriptionDocumentHint")}
            </p>
          </Field>

          <Field label={t("navSection")}>
            <select
              className={inputClass}
              value={navItemCode}
              onChange={(e) => setNavItemCode(e.target.value)}
              disabled={pending}
            >
              <option value="">{tp("nsi")}</option>
              {navSections.map((section) => (
                <option key={section.code} value={section.code}>
                  {section.label}
                </option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="withLines"
              className="size-4"
              defaultChecked
              disabled={pending}
            />
            {t("withLines")}
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
              disabled={pending || !code}
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
