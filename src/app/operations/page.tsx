import { redirectWithSearch } from "@/lib/meta/redirect-with-search";

export default async function OperationsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  redirectWithSearch("/doc/operation", await searchParams);
}
