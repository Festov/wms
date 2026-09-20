import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { moduleForPath } from "@/lib/modules/registry";
import { canAccessNavSlug } from "@/lib/menu/permissions";
import { canAccessNsiPath } from "@/lib/nsi/permissions";
import { documentModuleForEntity } from "@/lib/meta/document-registry";
import {
  canAccessDocumentEntity,
  hasPermissionWithAliases,
} from "@/lib/permissions/entity-permissions";
import {
  modulePermissionCode,
  type PermissionCode,
} from "@/lib/permissions/registry";

const { auth } = NextAuth(authConfig);

/** Next.js 16+: middleware renamed to proxy (nodejs runtime). */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  const withNoStore = (res: NextResponse) => {
    res.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0",
    );
    res.headers.set("Pragma", "no-cache");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return res;
  };

  const next = () =>
    withNoStore(
      NextResponse.next({
        request: { headers: requestHeaders },
      }),
    );

  if (pathname === "/login" && req.auth?.user) {
    return withNoStore(NextResponse.redirect(new URL("/", req.url)));
  }

  if (!req.auth?.user) {
    const isPublic =
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/tsd") ||
      pathname.startsWith("/api/integration") ||
      pathname === "/login" ||
      pathname === "/manifest.webmanifest" ||
      pathname === "/sw.js" ||
      pathname.startsWith("/icons");
    if (!isPublic) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", pathname);
      return withNoStore(NextResponse.redirect(login));
    }
    return next();
  }

  const roles = req.auth.user.roles ?? [];
  const isAdmin = roles.includes("admin");
  const permissions = (req.auth.user.permissions ?? []) as PermissionCode[];
  const mod = moduleForPath(pathname);

  if (!isAdmin && mod?.code === "nsi") {
    if (!canAccessNsiPath(pathname, permissions)) {
      return withNoStore(NextResponse.redirect(new URL("/forbidden", req.url)));
    }
  } else if (!isAdmin && mod?.code === "menus") {
    const slug = pathname.match(/^\/m\/([^/]+)/)?.[1];
    if (slug && !canAccessNavSlug(slug, permissions)) {
      return withNoStore(NextResponse.redirect(new URL("/forbidden", req.url)));
    }
    const docEntity = pathname.match(/^\/doc\/([^/]+)/)?.[1];
    if (
      docEntity &&
      !documentModuleForEntity(docEntity) &&
      !canAccessDocumentEntity(docEntity, permissions)
    ) {
      return withNoStore(NextResponse.redirect(new URL("/forbidden", req.url)));
    }
  } else if (!isAdmin && mod) {
    const need = modulePermissionCode(mod.code);
    if (!hasPermissionWithAliases(permissions, need)) {
      return withNoStore(NextResponse.redirect(new URL("/forbidden", req.url)));
    }
    const docEntity = pathname.match(/^\/doc\/([^/]+)/)?.[1];
    if (
      docEntity &&
      documentModuleForEntity(docEntity) &&
      mod.code !== documentModuleForEntity(docEntity)
    ) {
      return withNoStore(NextResponse.redirect(new URL("/forbidden", req.url)));
    }
  }

  return next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
