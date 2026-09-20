import type { RoleCode } from "@/lib/modules/registry";

export const WRITE_ROLES: RoleCode[] = ["admin"];

export function userHasRole(
  user: { roles: RoleCode[] },
  ...roles: RoleCode[]
) {
  return roles.some((r) => user.roles.includes(r));
}

export function userCanWrite(user: { roles: RoleCode[] }) {
  return userHasRole(user, ...WRITE_ROLES);
}
