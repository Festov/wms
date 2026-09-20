import { describe, expect, it, vi } from "vitest";
import {
  parseGuardConfig,
  parseTriggerConfig,
  serializeGuardConfig,
} from "@/lib/workflow/types";

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

vi.mock("@/lib/workflow/seed", () => ({
  ensureStatusWorkflows: vi.fn(),
}));

describe("workflow types", () => {
  it("serializes guard config", () => {
    expect(serializeGuardConfig("hasLines")).toBe(JSON.stringify({ guard: "hasLines" }));
    expect(parseGuardConfig(serializeGuardConfig("hasLines"))).toBe("hasLines");
  });

  it("parses trigger config", () => {
    expect(parseTriggerConfig('{"event":"receive.complete"}')).toEqual({
      event: "receive.complete",
    });
  });
});
