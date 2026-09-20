import { describe, expect, it } from "vitest";
import { isWeakTsdApiKey } from "@/lib/security/startup-checks";

describe("isWeakTsdApiKey", () => {
  it("flags demo and empty keys", () => {
    expect(isWeakTsdApiKey("")).toBe(true);
    expect(isWeakTsdApiKey("tsd-demo-key")).toBe(true);
    expect(isWeakTsdApiKey("demo")).toBe(true);
  });

  it("accepts strong keys", () => {
    expect(isWeakTsdApiKey("tsd_a1b2c3d4e5f6")).toBe(false);
  });
});

describe("moduleForApiPath", () => {
  it("maps tsd routes to modules", async () => {
    const { moduleForApiPath } = await import("@/lib/modules/registry");
    expect(moduleForApiPath("/api/tsd/receive")?.code).toBe("inbound");
    expect(moduleForApiPath("/api/tsd/pick")?.code).toBe("outbound");
    expect(moduleForApiPath("/api/tsd/transfer")?.code).toBe("topology");
  });
});
