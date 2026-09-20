import { describe, expect, it } from "vitest";
import { tsdPickSchema, integrationInboxSchema } from "@/lib/schemas/tsd";

describe("tsdPickSchema", () => {
  it("validates pick payload", () => {
    const parsed = tsdPickSchema.safeParse({
      productBarcode: "SKU1",
      locationCode: "A-01",
      quantity: 2,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid quantity", () => {
    const parsed = tsdPickSchema.safeParse({
      productBarcode: "SKU1",
      locationCode: "A-01",
      quantity: 0,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("integrationInboxSchema", () => {
  it("requires source and eventType", () => {
    const parsed = integrationInboxSchema.safeParse({
      source: "erp",
      externalId: "1",
      eventType: "product.upsert",
      payload: { sku: "A" },
    });
    expect(parsed.success).toBe(true);
  });
});
