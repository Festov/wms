import { AdminTabs } from "@/components/admin-tabs";
import { requireAdmin } from "@/lib/session";

export default async function AdminSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <>
      <AdminTabs />
      {children}
    </>
  );
}
