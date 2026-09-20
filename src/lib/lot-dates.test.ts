import { describe, expect, it } from "vitest";
import {
  addShelfLife,
  calcManufacturedAt,
  hasProductShelfLife,
  resolveLotDates,
  subtractShelfLife,
} from "@/lib/lot-dates";

describe("lot-dates", () => {
  it("adds shelf life in days", () => {
    const mfg = new Date("2026-01-01T00:00:00.000Z");
    const exp = addShelfLife(mfg, 30, "DAY");
    expect(exp.toISOString().slice(0, 10)).toBe("2026-01-31");
  });

  it("subtracts shelf life for manufactured date", () => {
    const exp = new Date("2026-02-01T00:00:00.000Z");
    const mfg = subtractShelfLife(exp, 30, "DAY");
    expect(mfg.toISOString().slice(0, 10)).toBe("2026-01-02");
  });

  it("calcManufacturedAt from expiry and shelf life", () => {
    const exp = new Date("2026-06-01T00:00:00.000Z");
    const mfg = calcManufacturedAt(exp, 90, "DAY", null);
    expect(mfg?.toISOString().slice(0, 10)).toBe("2026-03-03");
  });

  it("resolveLotDates with shelf life and expiry only", () => {
    const result = resolveLotDates({
      expiryDate: new Date("2026-12-31T00:00:00.000Z"),
      shelfLifeDays: 365,
      shelfLifeUnit: "DAY",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expiryDate.toISOString().slice(0, 10)).toBe("2026-12-31");
      expect(result.manufacturedAt.toISOString().slice(0, 10)).toBe("2025-12-31");
    }
  });

  it("hasProductShelfLife", () => {
    expect(hasProductShelfLife(30)).toBe(true);
    expect(hasProductShelfLife(0)).toBe(false);
    expect(hasProductShelfLife(null)).toBe(false);
  });
});
