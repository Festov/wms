import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { headers } from "next/headers";
import { cache } from "react";
import { NextIntlClientProvider } from "next-intl";
import {
  getLocale,
  getMessages,
  getTranslations,
} from "next-intl/server";
import { AppShell } from "@/components/ui";
import { StatusCatalogProvider } from "@/components/status-styles-provider";
import { DisableBrowserCache } from "@/components/disable-browser-cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { type ModuleCode, type ModuleFlags } from "@/lib/modules/registry";
import { getWarehouseIdentity } from "@/lib/settings/warehouse";
import { getSessionUser, getModuleFlags } from "@/lib/session";
import { getStatusCatalog } from "@/lib/status/styles";
import { resolveLocale } from "@/i18n/config";
import {
  buildSidebarLinks,
  createSidebarLabelResolver,
} from "@/lib/nav/build-sidebar-links";
import { listNavItems } from "@/lib/nav/catalog";
import { parseSidebarNavOrder } from "@/lib/nav/sidebar-menu";
import {
  ensureRolePermissions,
  getEffectivePermissionSet,
  getUserAllowedModules,
} from "@/lib/permissions/check";
import { ensureSystemMeta } from "@/lib/meta/seed-system";
import "./globals.css";

const sans = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { title, code } = await getWarehouseIdentity();
  const t = await getTranslations("metadata");
  return {
    title: {
      default: title,
      template: `%s · ${code}`,
    },
    description: t("description"),
    manifest: "/manifest.webmanifest",
  };
}

export const dynamic = "force-dynamic";

const getShellData = cache(async () => {
  try {
    const [settings, iconOverrides, navItems, catalogEntities, moduleFlags] =
      await Promise.all([
        prisma.settings.findUnique({ where: { id: 1 } }),
        prisma.navIconOverride.findMany(),
        listNavItems(),
        prisma.metaEntity.findMany({
          where: { isActive: true, kind: { in: ["catalog", "document"] }, storage: "custom" },
          select: { code: true, navItemCode: true, kind: true },
        }),
        getModuleFlags(),
      ]);
    const icons = Object.fromEntries(
      iconOverrides.map((o) => [o.code, o.iconKey]),
    );
    return {
      warehouseName: settings?.warehouseName ?? "Склад",
      modules: moduleFlags,
      icons,
      navItems,
      catalogEntities,
      sidebarOrder: parseSidebarNavOrder(settings?.sidebarNavOrder),
    };
  } catch {
    return {
      warehouseName: "Склад",
      modules: {
        inbound: true,
        outbound: true,
        inventory: true,
        operations: true,
        topology: true,
        lots: true,
        menus: true,
        tsd: true,
      } satisfies ModuleFlags,
      icons: {} as Record<string, string>,
      navItems: [],
      catalogEntities: [] as { code: string; navItemCode: string | null; kind: string }[],
      sidebarOrder: null,
    };
  }
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (session?.user?.id) {
    await Promise.all([ensureRolePermissions(), ensureSystemMeta(prisma)]);
  }
  const [shellData, statusCatalog, sessionUser, locale, messages, t] =
    await Promise.all([
      getShellData(),
      getStatusCatalog(resolveLocale(await getLocale())),
      getSessionUser(),
      getLocale(),
      getMessages(),
      getTranslations(),
    ]);
  const allowedModules = sessionUser
    ? await getUserAllowedModules(sessionUser.id)
    : new Set<ModuleCode>();
  const permissions = sessionUser
    ? await getEffectivePermissionSet(sessionUser.id, sessionUser.roles)
    : new Set<string>();

  const pathname = (await headers()).get("x-pathname") ?? "";
  const bareShell =
    pathname === "/login" ||
    pathname === "/tsd" ||
    pathname.startsWith("/tsd/");

  const links = buildSidebarLinks(
    {
      modules: shellData.modules,
      icons: shellData.icons,
      allowedModules,
      permissions,
      navItems: shellData.navItems,
      catalogEntities: shellData.catalogEntities,
      sidebarOrder: shellData.sidebarOrder,
    },
    createSidebarLabelResolver(t),
  );

  return (
    <html lang={locale} className={`${sans.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <DisableBrowserCache />
          {bareShell ? (
            children
          ) : (
            <StatusCatalogProvider catalog={statusCatalog}>
              <AppShell
                links={links}
                userName={session?.user?.name}
                userEmail={session?.user?.login}
              >
                {children}
              </AppShell>
            </StatusCatalogProvider>
          )}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
