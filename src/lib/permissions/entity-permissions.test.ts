import { describe, expect, it } from "vitest";
import {
  expandPermissionAliases,
  hasPermissionWithAliases,
  permissionForEntity,
} from "@/lib/permissions/entity-permissions";

describe("entity permissions", () => {
  it("expands module and document aliases bidirectionally", () => {
    expect(expandPermissionAliases("module.inbound")).toContain("document.inbound");
    expect(expandPermissionAliases("document.inbound")).toContain("module.inbound");
  });

  it("accepts document permission when only module is granted", () => {
    const perms = new Set(["module.inbound"]);
    expect(hasPermissionWithAliases(perms, "document.inbound")).toBe(true);
    expect(hasPermissionWithAliases(perms, "module.inbound")).toBe(true);
  });

  it("accepts module permission when only document is granted", () => {
    const perms = new Set(["document.outbound.write"]);
    expect(hasPermissionWithAliases(perms, "module.outbound.write")).toBe(true);
  });

  it("resolves system document permissions", async () => {
    expect(await permissionForEntity("inbound", "view")).toBe("document.inbound");
    expect(await permissionForEntity("inbound", "write")).toBe(
      "document.inbound.write",
    );
    expect(await permissionForEntity("operation", "view")).toBe(
      "document.operation",
    );
  });
});
