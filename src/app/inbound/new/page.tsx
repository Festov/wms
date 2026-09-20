import { redirect } from "next/navigation";
import { docNewPath } from "@/lib/meta/document-paths";

export default function InboundNewRedirectPage() {
  redirect(docNewPath("inbound"));
}
