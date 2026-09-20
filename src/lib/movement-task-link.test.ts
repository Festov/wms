import { describe, expect, it } from "vitest";
import { movementTaskHref } from "@/lib/movement-task-link";

const base = {
  type: "TRANSFER",
  quantity: 1,
  product: { sku: "SKU", name: "Item" },
};

describe("movementTaskHref", () => {
  it("links inbound and outbound documents", () => {
    expect(
      movementTaskHref({
        ...base,
        referenceType: "InboundDocument",
        referenceId: "in-1",
      }),
    ).toBe("/doc/inbound/in-1");
    expect(
      movementTaskHref({
        ...base,
        referenceType: "OutboundDocument",
        referenceId: "out-1",
      }),
    ).toBe("/doc/outbound/out-1");
  });

  it("links operation documents", () => {
    expect(
      movementTaskHref({
        ...base,
        referenceType: "OperationDocument",
        referenceId: "op-1",
      }),
    ).toBe("/doc/operation/op-1");
    expect(
      movementTaskHref({
        ...base,
        referenceType: "PUTAWAY",
        referenceId: "op-2",
      }),
    ).toBe("/doc/operation/op-2");
  });

  it("does not fall back to catalog pallets", () => {
    expect(
      movementTaskHref({
        ...base,
        palletId: "pal-1",
      }),
    ).toBeNull();
  });
});
