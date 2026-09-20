import { requireUser } from "@/lib/session";

export default async function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return children;
}
