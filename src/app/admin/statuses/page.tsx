import { getLocale, getTranslations } from "next-intl/server";
import {
  DataTable,
  Page,
  PageHeader,
  Panel,
  StatusBadge,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { saveStatusStreams } from "@/lib/admin-actions";
import { prisma } from "@/lib/db";
import { ensureStatuses } from "@/lib/status/seed";
import { resolveStatusAppearance } from "@/lib/status/appearance";
import { listWorkflows } from "@/lib/workflow/engine";
import { addStatusTransition, deleteStatusTransitionAction } from "@/lib/workflow/actions";
import { requireAdmin } from "@/lib/session";
import { resolveLocale } from "@/i18n/config";
import { userHasPermission } from "@/lib/permissions/check";
import {
  resolveWorkflowName,
  resolveWorkflowTriggerLabel,
} from "@/lib/i18n/seed-labels";
import { CreateStatusButton } from "./create-status-button";

const STREAM_KEYS = [
  "forInbound",
  "forOutbound",
  "forPutaway",
  "forPallet",
  "forTransfer",
] as const;

const COLOR_FIELD_KEYS = ["colorBg", "colorFg", "colorBorder"] as const;

const STATUS_COL_WIDTHS = [
  "7%",
  "9%",
  "28%",
  "5%",
  "5%",
  "5%",
  "7%",
  "7%",
  "7%",
  "7%",
  "7%",
  "6%",
];

export default async function AdminStatusesPage() {
  const user = await requireAdmin();
  const locale = resolveLocale(await getLocale());
  const canWrite = await userHasPermission(user.id, "module.admin.write");
  const t = await getTranslations("pages.admin.statuses");
  const tc = await getTranslations("common");
  const tDel = await getTranslations("pages.common");
  await ensureStatuses(prisma);

  const streams = STREAM_KEYS.map((key) => ({
    key,
    label: t(`streams.${key}.label`),
    title: t(`streams.${key}.title`),
  }));
  const colorFields = COLOR_FIELD_KEYS.map((key) => ({
    key,
    label: t(key === "colorBg" ? "bg" : key === "colorFg" ? "fg" : "border"),
    title: t(key === "colorBg" ? "bg" : key === "colorFg" ? "fg" : "border"),
  }));

  const statuses = await prisma.status.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  const workflows = await listWorkflows();
  const statusByCode = Object.fromEntries(statuses.map((s) => [s.code, s]));

  function statusLabel(code: string | null | undefined) {
    if (!code) return "—";
    const row = statusByCode[code];
    if (!row) return code;
    return resolveStatusAppearance(code, row, locale).name;
  }

  function guardLabel(guard: string | undefined) {
    if (!guard || guard === "none") return "—";
    if (guard === "hasLines") return t("guards.hasLines");
    if (guard === "readyToPlace") return t("guards.readyToPlace");
    return guard;
  }

  function formatTrigger(trigger: {
    kind: string;
    label: string | null;
    config: string | null;
  }) {
    const kindLabel = t(`triggerKinds.${trigger.kind}` as "triggerKinds.manual");
    const actionLabel = resolveWorkflowTriggerLabel(trigger.label, locale);
    const config = trigger.config ? ` (${trigger.config})` : "";
    return `${kindLabel}${actionLabel ? `: ${actionLabel}` : ""}${config}`;
  }

  return (
    <Page>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={canWrite ? <CreateStatusButton /> : undefined}
      />

      <Panel flush>
        <form action={saveStatusStreams}>
          <DataTable
            colWidths={STATUS_COL_WIDTHS}
            headers={[
              { label: t("code"), title: t("code") },
              { label: t("sample"), title: t("sample") },
              { label: t("name"), title: t("name") },
              ...colorFields.map((c) => ({
                label: c.label,
                className: "normal-case text-center",
                title: c.title,
              })),
              ...streams.map((s) => ({
                label: s.label,
                className: "normal-case text-center",
                title: s.title,
              })),
              {
                label: t("active"),
                className: "normal-case text-center",
                title: t("active"),
              },
            ]}
          >
            {statuses.map((st) => {
              const appearance = resolveStatusAppearance(st.code, st, locale);
              return (
                <tr key={st.id} className="align-middle">
                  <td className="px-3 py-2 font-medium">{st.code}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={st.code} label={appearance.name} />
                  </td>
                  <td className="min-w-0 px-3 py-2">
                    <input
                      className={inputClass}
                      name={`name:${st.id}`}
                      defaultValue={appearance.name}
                      aria-label={`${t("name")} ${st.code}`}
                    />
                  </td>
                  {colorFields.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-center">
                      <input
                        type="color"
                        className="mx-auto h-9 w-12 cursor-pointer rounded border border-[var(--line)] bg-white p-0.5"
                        name={`${c.key}:${st.id}`}
                        defaultValue={
                          (st[c.key] as string | null) ??
                          appearance[
                            c.key === "colorBg"
                              ? "bg"
                              : c.key === "colorFg"
                                ? "fg"
                                : "border"
                          ]
                        }
                        aria-label={`${c.label} ${st.code}`}
                      />
                    </td>
                  ))}
                  {STREAM_KEYS.map((s) => (
                    <td key={s} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        className="size-4"
                        name={`${s}:${st.id}`}
                        value="1"
                        defaultChecked={Boolean(st[s])}
                        aria-label={`${st.code} — ${t(`streams.${s}.label`)}`}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      className="size-4"
                      name={`isActive:${st.id}`}
                      value="1"
                      defaultChecked={st.isActive}
                      aria-label={`${st.code} — ${t("active")}`}
                    />
                  </td>
                </tr>
              );
            })}
          </DataTable>
          <div className="border-t border-[var(--line)] px-4 py-3">
            <button className={buttonClass} type="submit">
              {tc("save")}
            </button>
          </div>
        </form>
      </Panel>

      <Panel>
        <p className="mb-4 text-sm text-[var(--muted)]">{t("workflowHint")}</p>
        <div className="space-y-6">
          {workflows.map((wf) => (
            <div key={wf.id} className="rounded border border-[var(--line)]">
              <div className="border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2 font-medium">
                {resolveWorkflowName(wf.code, wf.name, locale)}{" "}
                <span className="text-sm font-normal text-[var(--muted)]">
                  ({wf.code} · {wf.entityCode ?? "—"})
                </span>
              </div>
              <DataTable
                headers={[t("from"), t("to"), t("guard"), t("triggers"), ""]}
                empty={t("noTransitions")}
              >
                {wf.transitions.map((tr) => (
                  <tr key={tr.id}>
                    <td className="px-3 py-2">{statusLabel(tr.fromStatusCode)}</td>
                    <td className="px-3 py-2 font-medium">
                      {statusLabel(tr.toStatusCode)}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted)]">
                      {tr.guardConfig
                        ? guardLabel(JSON.parse(tr.guardConfig).guard)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {tr.triggers.map((trg) => formatTrigger(trg)).join(" · ") ||
                        "—"}
                    </td>
                    <td className="px-3 py-2">
                      <form action={deleteStatusTransitionAction}>
                        <input type="hidden" name="transitionId" value={tr.id} />
                        <button
                          type="submit"
                          className="text-sm text-[var(--danger)] hover:underline"
                        >
                          {tDel("delete")}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </DataTable>
              <form action={addStatusTransition} className="grid gap-2 border-t border-[var(--line)] p-4 md:grid-cols-7">
                <input type="hidden" name="workflowId" value={wf.id} />
                <select className={inputClass} name="fromStatusCode" defaultValue="">
                  <option value="">{t("fromEmpty")}</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.code}>
                      {statusLabel(s.code)} ({s.code})
                    </option>
                  ))}
                </select>
                <select className={inputClass} name="toStatusCode" required>
                  <option value="">{t("toStatus")}</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.code}>
                      {statusLabel(s.code)} ({s.code})
                    </option>
                  ))}
                </select>
                <select className={inputClass} name="guard" defaultValue="none">
                  <option value="none">{t("noGuard")}</option>
                  <option value="hasLines">{t("guards.hasLines")}</option>
                  <option value="readyToPlace">{t("guards.readyToPlace")}</option>
                </select>
                <select className={inputClass} name="triggerKind" defaultValue="manual">
                  <option value="manual">{t("triggerKinds.manual")}</option>
                  <option value="tsd">{t("triggerKinds.tsd")}</option>
                  <option value="auto">{t("triggerKinds.auto")}</option>
                  <option value="integration">{t("triggerKinds.integration")}</option>
                </select>
                <input
                  className={inputClass}
                  name="label"
                  placeholder={t("buttonLabel")}
                />
                <input
                  className={inputClass}
                  name="event"
                  placeholder={t("tsdEvent")}
                />
                <button className={buttonClass} type="submit">
                  {t("addTransition")}
                </button>
              </form>
            </div>
          ))}
        </div>
      </Panel>
    </Page>
  );
}
