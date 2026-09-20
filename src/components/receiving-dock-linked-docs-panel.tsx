import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Panel, StatusBadge } from "@/components/ui";
import { docDetailPath } from "@/lib/meta/document-paths";

type LinkedDoc = { id: string; number: string; status: string };

export async function ReceivingDockLinkedDocsPanel({
  inboundDocuments,
  outboundDocuments,
}: {
  inboundDocuments: LinkedDoc[];
  outboundDocuments: LinkedDoc[];
}) {
  if (inboundDocuments.length === 0 && outboundDocuments.length === 0) {
    return null;
  }

  const t = await getTranslations("components.receivingDockLinkedDocs");

  return (
    <>
      {inboundDocuments.length > 0 ? (
        <Panel flush title={t("inboundTitle")}>
          <table className="min-w-full text-left text-sm">
            <tbody className="divide-y divide-[var(--line)]">
              {inboundDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-3 py-2">
                    <Link
                      href={docDetailPath("inbound", doc.id)}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {doc.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={doc.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}

      {outboundDocuments.length > 0 ? (
        <Panel flush title={t("outboundTitle")}>
          <table className="min-w-full text-left text-sm">
            <tbody className="divide-y divide-[var(--line)]">
              {outboundDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-3 py-2">
                    <Link
                      href={docDetailPath("outbound", doc.id)}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {doc.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={doc.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}
    </>
  );
}
