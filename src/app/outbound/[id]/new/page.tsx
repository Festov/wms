import { redirect } from "next/navigation";
import { docLineNewPath } from "@/lib/meta/document-paths";

export default async function OutboundLineNewRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(docLineNewPath("outbound", id));
}
