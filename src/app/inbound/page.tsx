import { redirectWithSearch } from "@/lib/meta/redirect-with-search";

export default async function InboundRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  redirectWithSearch("/doc/inbound", await searchParams);
}
