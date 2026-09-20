import { redirect } from "next/navigation";

export function redirectWithSearch(
  target: string,
  searchParams: Record<string, string | undefined>,
) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) qs.set(key, value);
  }
  const suffix = qs.toString();
  redirect(suffix ? `${target}?${suffix}` : target);
}
