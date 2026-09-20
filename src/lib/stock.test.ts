import { describe, expect, it } from "vitest";
import {
  lotKeyOf,
  packageCountFromBase,
  packageKeyOf,
  palletKeyOf,
} from "@/lib/stock";

describe("stock helpers", () => {
  it("normalizes nullable keys", () => {
    expect(lotKeyOf(null)).toBe("");
    expect(lotKeyOf("lot-1")).toBe("lot-1");
    expect(palletKeyOf(undefined)).toBe("");
    expect(packageKeyOf("pkg")).toBe("pkg");
  });

  it("packageCountFromBase", () => {
    expect(packageCountFromBase(20, 10)).toBe(2);
    expect(packageCountFromBase(15, 10)).toBe(1.5);
    expect(packageCountFromBase(10, 0)).toBeNull();
    expect(packageCountFromBase(10, null)).toBeNull();
  });
});
