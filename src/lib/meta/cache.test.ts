import { describe, expect, it, beforeEach } from "vitest";
import {
  getCachedMetaEntity,
  invalidateMetaEntityCache,
  setCachedMetaEntity,
} from "@/lib/meta/cache";

describe("meta cache", () => {
  beforeEach(() => {
    invalidateMetaEntityCache();
  });

  it("stores and retrieves entity by code", () => {
    const entity = {
      id: "e1",
      code: "zones",
      name: "Зона",
      pluralName: "Зоны",
      kind: "catalog",
      storage: "system",
      navItemCode: null,
      description: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      sections: [],
      attributes: [],
    };
    setCachedMetaEntity("zones", entity);
    expect(getCachedMetaEntity("zones")?.id).toBe("e1");
    expect(getCachedMetaEntity("units")).toBeUndefined();
  });

  it("invalidates single or all entries", () => {
    setCachedMetaEntity("a", { id: "1" } as never);
    setCachedMetaEntity("b", { id: "2" } as never);
    invalidateMetaEntityCache("a");
    expect(getCachedMetaEntity("a")).toBeUndefined();
    expect(getCachedMetaEntity("b")?.id).toBe("2");
    invalidateMetaEntityCache();
    expect(getCachedMetaEntity("b")).toBeUndefined();
  });
});
