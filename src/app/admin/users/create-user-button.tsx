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
import { createUser } from "@/lib/admin-actions";

type RoleOption = { code: string; name: string };

export function CreateUserButton({ roles }: { roles: RoleOption[] }) {
  const t = useTranslations("dialogs.admin.users");
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
      <CreateUserDialog
        open={open}
        roles={roles}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function CreateUserDialog({
  open,
  onClose,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  roles: RoleOption[];
}) {
  const t = useTranslations("dialogs.admin.users");
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
        await createUser(formData);
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

  const defaultRole =
    roles.find((role) => role.code !== "admin")?.code ?? roles[0]?.code ?? "";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-user-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h3 id="create-user-title" className="text-sm font-semibold">
            {t("title")}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {t("description")}
          </p>
        </div>
        <form action={submit} className="space-y-3 p-4">
          <Field label={t("login")}>
            <input
              className={inputClass}
              name="login"
              required
              autoFocus
              disabled={pending}
            />
          </Field>
          <Field label={t("name")}>
            <input
              className={inputClass}
              name="name"
              required
              disabled={pending}
            />
          </Field>
          <Field label={t("password")}>
            <input
              className={inputClass}
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              disabled={pending}
            />
          </Field>
          <Field label={t("role")}>
            <select
              className={inputClass}
              name="role"
              defaultValue={defaultRole}
              required
              disabled={pending || roles.length === 0}
            >
              {roles.length === 0 ? (
                <option value="">{t("noRoles")}</option>
              ) : null}
              {roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
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
            <button className={buttonClass} type="submit" disabled={pending || roles.length === 0}>
              {pending ? tp("creating") : tp("create")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
