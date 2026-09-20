import { redirect } from "next/navigation";
import { docDetailPath } from "@/lib/meta/document-paths";

export default async function OutboundDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(docDetailPath("outbound", id));
}
