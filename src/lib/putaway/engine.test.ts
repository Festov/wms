import { describe, expect, it } from "vitest";

describe("putaway registry", () => {
  it("exports putaway rules", async () => {
    const { PUTAWAY_RULE_REGISTRY } = await import("@/lib/putaway/registry");
    expect(PUTAWAY_RULE_REGISTRY.length).toBeGreaterThan(0);
    expect(PUTAWAY_RULE_REGISTRY[0]?.code).toBeTruthy();
  });
});

describe("meta cache", () => {
  it("invalidates entity cache", async () => {
    const { invalidateMetaEntityCache, getCachedMetaEntity } =
      await import("@/lib/meta/cache");
    invalidateMetaEntityCache("test");
    expect(getCachedMetaEntity("test")).toBeUndefined();
  });
});
