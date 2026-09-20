import { getTranslations } from "next-intl/server";
import {
  Page,
  PageHeader,
  Panel,
  buttonCompactClass,
  buttonDangerCompactClass,
  buttonSecondaryCompactClass,
} from "@/components/ui";
import { ConfirmForm } from "@/components/confirm-form";
import { MenuIconCell } from "@/app/admin/nav/menu-icon-cell";
import {
  deleteNavItem,
  moveSidebarNavEntry,
  updateNavItem,
} from "@/lib/nav/actions";
import { saveNavIcon } from "@/lib/meta/actions";
import { loadAdminMenuRows } from "@/lib/nav/admin-menu";
import { entityCodeFromNavItemCode } from "@/lib/nav/helpers";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { translateSidebarKey } from "@/lib/i18n/labels";
import { CreateNavItemButton } from "./create-nav-item-button";
import { EditNavItemButton } from "./edit-nav-item-button";

export default async function AdminNavPage() {
  await requireAdmin();
  const t = await getTranslations("pages.admin.nav");
  const tc = await getTranslations("pages.common");
  const tSave = await getTranslations("common");
  const tRoot = await getTranslations();

  const [iconOverrides] = await Promise.all([
    prisma.navIconOverride.findMany(),
  ]);

  const iconMap = Object.fromEntries(
    iconOverrides.map((o) => [o.code, o.iconKey]),
  );
  const { rows: rawRows } = await loadAdminMenuRows(iconMap);
  const rows = rawRows.map((row) => ({
    ...row,
    label:
      row.kind === "system"
        ? translateSidebarKey(row.key, (key) => tRoot(key))
        : row.label,
  }));

  function rowCode(key: string, kind: "system" | "custom") {
    return kind === "custom" ? entityCodeFromNavItemCode(key) : key;
  }

  return (
    <Page>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={<CreateNavItemButton />}
      />

      <Panel flush>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            {t("empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] table-fixed text-sm">
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "40%" }} />
            </colgroup>
            <thead className="bg-[var(--surface)]/70 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              <tr className="border-b border-[var(--line)]">
                <th className="px-3 py-2 text-left font-medium">{t("item")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("preview")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("icon")}</th>
                <th className="px-3 py-2 text-left font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                async function moveUp() {
                  "use server";
                  await moveSidebarNavEntry(row.key, "up");
                }
                async function moveDown() {
                  "use server";
                  await moveSidebarNavEntry(row.key, "down");
                }

                const formId =
                  row.kind === "system"
                    ? `menu-system-${row.key.replace(/[^a-z0-9_-]/gi, "_")}`
                    : `menu-custom-${row.navItemId}`;

                if (row.kind === "system") {
                  return (
                    <tr
                      key={row.key}
                      className="border-b border-[var(--line)] align-middle last:border-0"
                    >
                      <td className="px-3 py-2">
                        <form id={formId} action={saveNavIcon}>
                          <input type="hidden" name="code" value={row.key} />
                        </form>
                        <p className="min-w-0 truncate text-sm">
                          <span className="font-medium">{row.label}</span>
                          <span className="text-[var(--muted)]">
                            {" "}
                            · {rowCode(row.key, row.kind)}
                          </span>
                        </p>
                      </td>
                      <MenuIconCell
                        formId={formId}
                        initialIconKey={row.iconKey}
                        label={row.label}
                      />
                      <td className="px-3 py-2">
                        <div className="flex flex-nowrap items-center justify-end gap-1">
                          <button
                            className={buttonCompactClass}
                            type="submit"
                            form={formId}
                          >
                            {tSave("save")}
                          </button>
                          <form action={moveUp} className="inline-flex shrink-0">
                            <button
                              type="submit"
                              className={buttonSecondaryCompactClass}
                              disabled={index === 0}
                              title={tc("moveUp")}
                            >
                              ↑
                            </button>
                          </form>
                          <form action={moveDown} className="inline-flex shrink-0">
                            <button
                              type="submit"
                              className={buttonSecondaryCompactClass}
                              disabled={index === rows.length - 1}
                              title={tc("moveDown")}
                            >
                              ↓
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                }

                async function saveCustom(formData: FormData) {
                  "use server";
                  if (!row.navItemId) return;
                  await updateNavItem(row.navItemId, formData);
                }
                async function removeCustom() {
                  "use server";
                  if (!row.navItemId) return;
                  await deleteNavItem(row.navItemId);
                }

                return (
                  <tr
                    key={row.key}
                    className={`border-b border-[var(--line)] align-middle last:border-0 ${row.isActive ? "" : "opacity-50"}`}
                  >
                    <td className="px-3 py-2">
                      <form id={formId} action={saveCustom} />
                      <p className="min-w-0 truncate text-sm">
                        <span className="font-medium">{row.label}</span>
                        <span className="text-[var(--muted)]">
                          {" "}
                          · {rowCode(row.key, row.kind)}
                        </span>
                      </p>
                    </td>
                    <MenuIconCell
                      formId={formId}
                      initialIconKey={row.iconKey}
                      label={row.label}
                    />
                    <td className="px-3 py-2">
                      <div className="flex flex-nowrap items-center justify-end gap-1">
                        <ConfirmForm
                          action={removeCustom}
                          className="inline-flex shrink-0"
                          message={t("deleteConfirm", { label: row.label })}
                        >
                          <button
                            type="submit"
                            className={buttonDangerCompactClass}
                          >
                            {tc("delete")}
                          </button>
                        </ConfirmForm>
                        {row.navItemId ? (
                          <EditNavItemButton
                            navItemId={row.navItemId}
                            itemKey={row.key}
                            initialLabel={row.label}
                            iconKey={row.iconKey}
                            isActive={row.isActive}
                          />
                        ) : null}
                        <button
                          className={buttonCompactClass}
                          type="submit"
                          form={formId}
                        >
                          {tSave("save")}
                        </button>
                        <form action={moveUp} className="inline-flex shrink-0">
                          <button
                            type="submit"
                            className={buttonSecondaryCompactClass}
                            disabled={index === 0}
                            title={tc("moveUp")}
                          >
                            ↑
                          </button>
                        </form>
                        <form action={moveDown} className="inline-flex shrink-0">
                          <button
                            type="submit"
                            className={buttonSecondaryCompactClass}
                            disabled={index === rows.length - 1}
                            title={tc("moveDown")}
                          >
                            ↓
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}
