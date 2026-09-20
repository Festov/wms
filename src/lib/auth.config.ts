import type { NextAuthConfig } from "next-auth";
import type { RoleCode } from "@/lib/modules/registry";
import type { PermissionCode } from "@/lib/permissions/registry";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.login = (user as { login?: string }).login;
        token.roles = user.roles;
      }
      if (token.id) {
        const { getUserPermissionSet } = await import(
          "@/lib/permissions/check"
        );
        token.permissions = [
          ...(await getUserPermissionSet(token.id as string)),
        ];
        if (user?.roles) {
          token.roles = user.roles;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.login = token.login ?? "";
        session.user.roles = (token.roles as RoleCode[]) ?? [];
        session.user.permissions = (token.permissions as PermissionCode[]) ?? [];
        session.user.name = token.name ?? session.user.name ?? "";
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/tsd") ||
        pathname.startsWith("/api/integration") ||
        pathname === "/login" ||
        pathname === "/manifest.webmanifest" ||
        pathname === "/sw.js" ||
        pathname.startsWith("/icons")
      ) {
        return true;
      }
      if (pathname.match(/\.(png|jpg|jpeg|svg|ico|css|js|map)$/)) {
        return true;
      }
      return !!auth?.user;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
