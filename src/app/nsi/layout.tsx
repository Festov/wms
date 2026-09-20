import { NsiTabs } from "@/components/nsi-tabs";
import { requireNsiSection } from "@/lib/permissions/check";
import { getModuleFlags } from "@/lib/session";

export default async function NsiSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireNsiSection();
  const flags = await getModuleFlags();

  return (
    <>
      <NsiTabs flags={flags} />
      {children}
    </>
  );
}
