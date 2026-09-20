import { redirect } from "next/navigation";
import { docDetailPath } from "@/lib/meta/document-paths";

export default async function OperationDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(docDetailPath("operation", id));
}
