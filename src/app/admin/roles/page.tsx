import { getLocale, getTranslations } from "next-intl/server";
import {
  DataTable,
  Page,
  PageHeader,
  Panel,
  buttonDangerCompactClass,
} from "@/components/ui";
import { ConfirmForm } from "@/components/confirm-form";
import { deleteRole } from "@/lib/admin-actions";
import { prisma } from "@/lib/db";
import { ensureRolePermissions } from "@/lib/permissions/check";
import { loadCustomUiPermissionContext } from "@/lib/menu/permissions.server";
import type { PermissionCode } from "@/lib/permissions/registry";
import { requireAdmin } from "@/lib/session";
import { userHasPermission } from "@/lib/permissions/check";
import { resolveLocale } from "@/i18n/config";
import {
  resolveRoleDescription,
  resolveRoleName,
} from "@/lib/i18n/seed-labels";
import { CreateRoleButton } from "./create-role-button";
import { EditRolePermissionsButton } from "./edit-role-permissions-button";

export default async function AdminRolesPage() {
  const user = await requireAdmin();
  await ensureRolePermissions();
  const locale = resolveLocale(await getLocale());
  const canWrite = await userHasPermission(user.id, "module.admin.write");
  const t = await getTranslations("pages.admin.roles");
  const tc = await getTranslations("pages.common");

  const [roles, customUiContext] = await Promise.all([
    prisma.role.findMany({
      orderBy: { code: "asc" },
      include: {
        permissions: true,
        _count: { select: { users: true } },
      },
    }),
    loadCustomUiPermissionContext(),
  ]);

  return (
    <Page>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={canWrite ? <CreateRoleButton /> : undefined}
      />

      <Panel flush>
        <DataTable
          headers={[t("role"), t("descriptionCol"), t("users"), ""]}
          colWidths={["26%", "38%", "8%", "28%"]}
        >
          {roles.map((role) => {
            const initialEnabled = role.permissions
              .filter((p) => p.enabled)
              .map((p) => p.code as PermissionCode);
            const roleName = resolveRoleName(role.code, role.name, locale);
            const roleDescription = resolveRoleDescription(
              role.code,
              role.description,
              locale,
            );

            return (
              <tr key={role.id} className="align-middle text-sm">
                <td className="px-3 py-1.5">
                  <span className="font-medium">{roleName}</span>
                  <span className="ml-1.5 font-mono text-xs text-[var(--muted)]">
                    {role.code}
                  </span>
                  {role.isSystem ? (
                    <span className="ml-1.5 text-xs text-[var(--muted)]">
                      {tc("systemRole")}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5 text-[var(--muted)]">
                  {roleDescription}
                </td>
                <td className="px-3 py-1.5 text-center tabular-nums">
                  {role._count.users}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {canWrite && !role.isSystem ? (
                      role._count.users === 0 ? (
                        <ConfirmForm
                          action={deleteRole}
                          className="inline-flex"
                          message={t("deleteConfirm", { name: roleName })}
                        >
                          <input type="hidden" name="roleId" value={role.id} />
                          <button
                            type="submit"
                            className={buttonDangerCompactClass}
                          >
                            {tc("delete")}
                          </button>
                        </ConfirmForm>
                      ) : (
                        <button
                          type="button"
                          className={buttonDangerCompactClass}
                          disabled
                          title={t("deleteDisabledTitle", {
                            count: role._count.users,
                          })}
                        >
                          {tc("delete")}
                        </button>
                      )
                    ) : null}
                    <EditRolePermissionsButton
                      roleId={role.id}
                      initialEnabled={initialEnabled}
                      customUiContext={customUiContext}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>
    </Page>
  );
}
