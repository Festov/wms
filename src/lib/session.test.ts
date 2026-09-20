import { describe, expect, it } from "vitest";
import { userCanWrite, userHasRole } from "@/lib/roles";

describe("role helpers", () => {
  it("legacy write helper is limited to admin role name", () => {
    expect(userCanWrite({ roles: ["warehouse"] })).toBe(false);
  });

  it("admin role passes legacy write helper", () => {
    expect(userCanWrite({ roles: ["admin"] })).toBe(true);
  });

  it("userHasRole checks membership", () => {
    expect(userHasRole({ roles: ["warehouse"] }, "admin")).toBe(false);
    expect(userHasRole({ roles: ["admin"] }, "admin", "warehouse")).toBe(true);
  });
});
