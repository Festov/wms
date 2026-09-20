import { notFound } from "next/navigation";
import { NavMenuTabs } from "@/components/nav-menu-tabs";
import { prisma } from "@/lib/db";
import { navItemIconCode } from "@/lib/nav/helpers";
import { requireNavAccess } from "@/lib/permissions/check";
import { requireModule } from "@/lib/session";

export default async function NavHubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ nav: string }>;
}) {
  await requireModule("menus");
  const { nav } = await params;
  await requireNavAccess(nav);
  const navCode = navItemIconCode(nav);
  const item = await prisma.navItem.findFirst({
    where: { code: navCode, isActive: true },
  });
  if (!item) notFound();

  return (
    <>
      <NavMenuTabs navSlug={nav} />
      {children}
    </>
  );
}
