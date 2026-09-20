import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import type { RoleCode } from "@/lib/modules/registry";
import type { PermissionCode } from "@/lib/permissions/registry";
import { assertProductionSecrets } from "@/lib/security/startup-checks";

assertProductionSecrets();

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      login: string;
      name: string;
      roles: RoleCode[];
      permissions: PermissionCode[];
    };
  }

  interface User {
    login: string;
    roles: RoleCode[];
    permissions: PermissionCode[];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    login?: string;
    roles?: RoleCode[];
    permissions?: PermissionCode[];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        login: { label: "Login", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const login = String(
          credentials?.login ??
            (credentials as { username?: string })?.username ??
            "",
        )
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!login || !password) return null;

        const user =
          (await prisma.user.findUnique({
            where: { email: login },
            include: { roles: { include: { role: true } } },
          })) ??
          (await prisma.user.findFirst({
            where: {
              OR: [
                { email: { equals: login } },
                { email: { startsWith: `${login}@` } },
              ],
            },
            include: { roles: { include: { role: true } } },
          }));
        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        const roles = user.roles.map((r) => r.role.code as RoleCode);
        const { ensureRolePermissions, getEffectivePermissionSet } = await import(
          "@/lib/permissions/check"
        );
        await ensureRolePermissions();
        const permissions = [
          ...(await getEffectivePermissionSet(user.id, roles)),
        ];
        const displayLogin = user.email.includes("@")
          ? user.email.split("@")[0]
          : user.email;
        return {
          id: user.id,
          login: displayLogin,
          name: user.name,
          email: user.email,
          roles,
          permissions,
        };
      },
    }),
  ],
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
});
