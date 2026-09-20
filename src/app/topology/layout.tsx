import { NsiTabs } from "@/components/nsi-tabs";
import { getModuleFlags, requireUser } from "@/lib/session";

export default async function TopologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  const flags = await getModuleFlags();

  return (
    <>
      <NsiTabs flags={flags} />
      {children}
    </>
  );
}
