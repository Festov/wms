import { getLocale, getTranslations } from "next-intl/server";
import {
  DataTable,
  Page,
  PageHeader,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";
import {
  setUserRole,
  toggleUserActive,
} from "@/lib/admin-actions";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { resolveLocale } from "@/i18n/config";
import { resolveRoleName } from "@/lib/i18n/seed-labels";
import { CreateUserButton } from "./create-user-button";

export default async function AdminUsersPage() {
  await requireAdmin();
  const locale = resolveLocale(await getLocale());
  const t = await getTranslations("pages.admin.users");
  const tc = await getTranslations("pages.common");

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      orderBy: { email: "asc" },
      include: { roles: { include: { role: true } } },
    }),
    prisma.role.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <Page>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <CreateUserButton
            roles={roles.map((r) => ({
              code: r.code,
              name: resolveRoleName(r.code, r.name, locale),
            }))}
          />
        }
      />

      <Panel flush>
        <DataTable headers={[t("login"), t("name"), t("role"), t("status"), ""]}>
          {users.map((u) => {
            const role = u.roles[0]?.role.code ?? "—";
            return (
              <tr key={u.id}>
                <td className="px-3 py-2">
                  {u.email.includes("@") ? u.email.split("@")[0] : u.email}
                </td>
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2">
                  <form action={setUserRole} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <select
                      className={inputClass}
                      name="role"
                      defaultValue={role}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.code}>
                          {resolveRoleName(r.code, r.name, locale)}
                        </option>
                      ))}
                    </select>
                    <button className={buttonClass} type="submit">
                      {tc("ok")}
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2">
                  {u.isActive ? tc("active") : tc("disabled")}
                </td>
                <td className="px-3 py-2">
                  <form action={toggleUserActive}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button type="submit" className="text-[var(--accent)]">
                      {u.isActive ? tc("disable") : tc("enable")}
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>
    </Page>
  );
}
