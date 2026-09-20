"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  buttonClass,
  buttonSecondaryClass,
  buttonSecondaryCompactClass,
} from "@/components/ui";
import { saveRolePermissionsForRole } from "@/lib/admin-actions";
import {
  PERMISSION_GROUPS,
  buildPermissionMatrixForGroup,
  translatePermissionGroupTitle,
  type PermissionCode,
} from "@/lib/permissions/registry";
import type { CustomUiPermissionContext } from "@/lib/menu/permissions";
import { useLocale, useTranslations } from "next-intl";
import { resolveLocale } from "@/i18n/config";

export function EditRolePermissionsButton({
  roleId,
  initialEnabled,
  customUiContext,
}: {
  roleId: string;
  initialEnabled: PermissionCode[];
  customUiContext: CustomUiPermissionContext;
}) {
  const t = useTranslations("dialogs.admin.roles");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={buttonSecondaryCompactClass}
        onClick={() => setOpen(true)}
      >
        {t("editPermissions")}
      </button>
      <EditRolePermissionsDialog
        open={open}
        onClose={() => setOpen(false)}
        roleId={roleId}
        initialEnabled={initialEnabled}
        customUiContext={customUiContext}
      />
    </>
  );
}

function MatrixCheckbox({
  code,
  label,
  checked,
  disabled,
  onChange,
}: {
  code: PermissionCode;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      className="size-3.5"
      name={`perm:${code}`}
      value="1"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={label}
    />
  );
}

function EditRolePermissionsDialog({
  open,
  onClose,
  roleId,
  initialEnabled,
  customUiContext,
}: {
  open: boolean;
  onClose: () => void;
  roleId: string;
  initialEnabled: PermissionCode[];
  customUiContext: CustomUiPermissionContext;
}) {
  const t = useTranslations("dialogs.admin.roles");
  const tc = useTranslations("common");
  const tp = useTranslations("pages.common");
  const router = useRouter();
  const locale = resolveLocale(useLocale());
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Set<PermissionCode>>(
    () => new Set(initialEnabled),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setEnabled(new Set(initialEnabled));
  }, [open, initialEnabled]);

  function setPermission(code: PermissionCode, checked: boolean) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  function toggleView(viewCode: PermissionCode, writeCode: PermissionCode | undefined, checked: boolean) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (checked) next.add(viewCode);
      else {
        next.delete(viewCode);
        if (writeCode) next.delete(writeCode);
      }
      return next;
    });
  }

  function toggleWrite(viewCode: PermissionCode, writeCode: PermissionCode, checked: boolean) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(viewCode);
        next.add(writeCode);
      } else {
        next.delete(writeCode);
      }
      return next;
    });
  }

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await saveRolePermissionsForRole(formData);
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : tp("saveError"));
      }
    });
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-role-permissions-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-xl">
        <div className="shrink-0 border-b border-[var(--line)] px-4 py-3">
          <h3 id="edit-role-permissions-title" className="text-sm font-semibold">
            {t("permissionsTitle")}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {t("permissionsDescription")}
          </p>
        </div>

        <form action={submit} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="roleId" value={roleId} />

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {PERMISSION_GROUPS.map((group, groupIndex) => {
              const rows = buildPermissionMatrixForGroup(
                group.id,
                customUiContext,
                locale,
              );
              const accessOnly = group.id === "tsd";

              return (
                <section
                  key={group.id}
                  className={
                    groupIndex > 0 ? "mt-4 border-t border-[var(--line)] pt-4" : ""
                  }
                >
                  <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
                    <table className="w-full min-w-[20rem] text-left text-sm">
                      <thead className="bg-[var(--surface)]/70 text-xs uppercase tracking-wide text-[var(--muted)]">
                        <tr className="border-b border-[var(--line)]">
                          <th className="px-3 py-2 font-medium normal-case">
                            {translatePermissionGroupTitle(
                              group.id,
                              group.title,
                              locale,
                            )}
                          </th>
                          {accessOnly ? (
                            <th className="w-24 px-2 py-2 text-center font-medium">
                              {t("access")}
                            </th>
                          ) : (
                            <>
                              <th className="w-24 px-2 py-2 text-center font-medium">
                                {t("view")}
                              </th>
                              <th className="w-28 px-2 py-2 text-center font-medium">
                                {t("editColumn")}
                              </th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]">
                        {rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={accessOnly ? 2 : 3}
                              className="px-3 py-4 text-sm text-[var(--muted)]"
                            >
                              {group.id === "customUi"
                                ? t("emptyCustomUi")
                                : t("emptyGroup")}
                            </td>
                          </tr>
                        ) : (
                          rows.map((row) => (
                          <tr key={row.id} className="align-middle">
                            <td className="min-w-0 px-3 py-2">
                              <p className="font-medium leading-tight">{row.title}</p>
                              {row.description ? (
                                <p className="mt-0.5 text-xs leading-tight text-[var(--muted)]">
                                  {row.description}
                                </p>
                              ) : null}
                            </td>
                            {accessOnly && row.accessCode ? (
                              <td className="px-2 py-2 text-center">
                                <MatrixCheckbox
                                  code={row.accessCode}
                                  label={t("accessAria", { title: row.title })}
                                  checked={enabled.has(row.accessCode)}
                                  disabled={pending}
                                  onChange={(checked) =>
                                    setPermission(row.accessCode!, checked)
                                  }
                                />
                              </td>
                            ) : (
                              <>
                                <td className="px-2 py-2 text-center">
                                  {row.viewCode ? (
                                    <MatrixCheckbox
                                      code={row.viewCode}
                                      label={t("viewAria", { title: row.title })}
                                      checked={enabled.has(row.viewCode)}
                                      disabled={pending}
                                      onChange={(checked) =>
                                        toggleView(
                                          row.viewCode!,
                                          row.writeCode,
                                          checked,
                                        )
                                      }
                                    />
                                  ) : (
                                    <span className="text-[var(--muted)]">—</span>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-center">
                                  {row.writeCode ? (
                                    <MatrixCheckbox
                                      code={row.writeCode}
                                      label={t("editAria", { title: row.title })}
                                      checked={enabled.has(row.writeCode)}
                                      disabled={
                                        pending ||
                                        (row.viewCode
                                          ? !enabled.has(row.viewCode)
                                          : false)
                                      }
                                      onChange={(checked) =>
                                        row.viewCode &&
                                        toggleWrite(
                                          row.viewCode,
                                          row.writeCode!,
                                          checked,
                                        )
                                      }
                                    />
                                  ) : (
                                    <span className="text-[var(--muted)]">—</span>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>

          {error ? (
            <p className="shrink-0 px-4 pb-2 text-sm text-rose-700">{error}</p>
          ) : null}

          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--line)] px-4 py-3">
            <button
              type="button"
              className={buttonSecondaryClass}
              onClick={onClose}
              disabled={pending}
            >
              {tc("cancel")}
            </button>
            <button className={buttonClass} type="submit" disabled={pending}>
              {pending ? tp("saving") : tc("save")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
