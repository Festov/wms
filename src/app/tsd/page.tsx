import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { Page, PageHeader, Panel, buttonClass } from "@/components/ui";
import { getModuleFlags } from "@/lib/session";
import {
  ensureRolePermissions,
  getUserPermissionSet,
} from "@/lib/permissions/check";
import type { PermissionCode } from "@/lib/permissions/registry";

export const dynamic = "force-dynamic";

export default async function TsdHomePage() {
  const session = await auth();
  const flags = await getModuleFlags();
  await ensureRolePermissions();
  const t = await getTranslations("pages.tsd");
  const tc = await getTranslations("pages.common");

  const perms = session?.user?.id
    ? await getUserPermissionSet(session.user.id)
    : new Set<PermissionCode>();

  const actions = [
    {
      href: "/tsd/receive",
      title: t("receive"),
      enabled: flags.inbound && perms.has("tsd.receive"),
    },
    {
      href: "/tsd/putaway",
      title: t("putaway"),
      enabled:
        (flags.inbound || flags.topology) && perms.has("tsd.putaway"),
    },
    {
      href: "/tsd/pick",
      title: t("pick"),
      enabled: flags.outbound && perms.has("tsd.pick"),
    },
    {
      href: "/tsd/transfer",
      title: t("transfer"),
      enabled: perms.has("tsd.transfer"),
    },
    {
      href: "/tsd/device",
      title: t("device"),
      enabled: true,
    },
  ];

  return (
    <Page narrow>
      <PageHeader title={t("title")} />
      {!session?.user ? (
        <Panel>
          <Link href="/login?callbackUrl=/tsd" className={buttonClass}>
            {tc("signIn")}
          </Link>
        </Panel>
      ) : (
        <div className="grid gap-3">
          {actions.map((a) =>
            a.enabled ? (
              <a
                key={a.href}
                href={a.href}
                className="block rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:border-[var(--accent)]"
              >
                <h3 className="text-xl font-semibold">{a.title}</h3>
              </a>
            ) : (
              <div
                key={a.href}
                className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 opacity-50"
              >
                <h3 className="text-xl font-semibold">{a.title}</h3>
              </div>
            ),
          )}
        </div>
      )}
    </Page>
  );
}
