import { redirectWithSearch } from "@/lib/meta/redirect-with-search";

export default async function OutboundRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  redirectWithSearch("/doc/outbound", await searchParams);
}
