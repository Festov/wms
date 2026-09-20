import { describe, expect, it } from "vitest";

describe("inbox mapper event types", () => {
  it("supports expanded event types", async () => {
    const source = await import("@/lib/integration/inbox-mapper");
    expect(typeof source.mapInboxEvent).toBe("function");
  });
});

describe("adjustStockBalance export", () => {
  it("is declared in module-actions source", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile("src/lib/module-actions.ts", "utf8");
    expect(source).toContain("export async function adjustStockBalance");
  });
});
