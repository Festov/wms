import { describe, expect, it } from "vitest";
import { wrapOutboxPayload, OUTBOX_CONTRACT_VERSION } from "@/lib/integration/outbox-contract";

describe("outbox-contract", () => {
  it("wraps payload with version", () => {
    const payload = wrapOutboxPayload({ sku: "A-1" });
    expect(payload.version).toBe(OUTBOX_CONTRACT_VERSION);
    expect(payload.sku).toBe("A-1");
  });
});
