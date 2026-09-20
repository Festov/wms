import { describe, expect, it, vi } from "vitest";
import { mapInboxEvent } from "@/lib/integration/inbox-mapper";

describe("inbox-mapper", () => {
  it("rejects invalid payload", async () => {
    const result = await mapInboxEvent({} as never, {
      source: "test",
      eventType: "product.upsert",
      externalId: null,
      payload: null,
    });
    expect(result.ok).toBe(false);
  });

  it("upserts product", async () => {
    const prisma = {
      unit: {
        upsert: vi.fn().mockResolvedValue({ id: "u1" }),
      },
      product: {
        upsert: vi.fn().mockResolvedValue({ id: "p1" }),
      },
    };

    const result = await mapInboxEvent(prisma as never, {
      source: "1c",
      eventType: "product.upsert",
      externalId: "ext-1",
      payload: { sku: "SKU-1", name: "Товар 1" },
    });

    expect(result.ok).toBe(true);
    expect(prisma.product.upsert).toHaveBeenCalled();
  });
});
