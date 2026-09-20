import { getTranslations } from "next-intl/server";
import { DataTable, Panel, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/format";

export type InboundStatusHistoryView = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  source: string | null;
  note: string | null;
  changedByName: string | null;
};

function statusSourceLabel(
  source: string | null | undefined,
  t: (key: "sources.web" | "sources.tsd" | "sources.system") => string,
) {
  switch (source) {
    case "web":
      return t("sources.web");
    case "tsd":
      return t("sources.tsd");
    case "system":
      return t("sources.system");
    default:
      return "—";
  }
}

export async function InboundStatusHistoryPanel({
  entries,
}: {
  entries: InboundStatusHistoryView[];
}) {
  if (entries.length === 0) return null;

  const t = await getTranslations("components.statusHistory");

  return (
    <Panel flush title={t("title")}>
      <DataTable
        headers={[t("when"), t("from"), t("to"), t("source"), t("who"), t("note")]}
      >
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td className="px-3 py-2 text-[var(--muted)]">
              {formatDate(entry.changedAt)}
            </td>
            <td className="px-3 py-2">
              {entry.fromStatus ? (
                <StatusBadge status={entry.fromStatus} />
              ) : (
                "—"
              )}
            </td>
            <td className="px-3 py-2">
              <StatusBadge status={entry.toStatus} />
            </td>
            <td className="px-3 py-2">
              {statusSourceLabel(entry.source, t)}
            </td>
            <td className="px-3 py-2">{entry.changedByName ?? "—"}</td>
            <td className="px-3 py-2 text-[var(--muted)]">
              {entry.note ?? "—"}
            </td>
          </tr>
        ))}
      </DataTable>
    </Panel>
  );
}
