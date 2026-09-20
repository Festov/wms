import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  requireAdmin: vi.fn(),
  requireAdminWrite: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { prismaMock, getMetaEntityMock } = vi.hoisted(() => ({
  prismaMock: {
    metaAttribute: {
      create: vi.fn(),
    },
  },
  getMetaEntityMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/meta/catalog", () => ({
  getMetaEntity: getMetaEntityMock,
  invalidateMetaEntityCache: vi.fn(),
}));

import { addMetaAttribute } from "@/lib/meta/actions";

describe("addMetaAttribute", () => {
  it("stores unchecked visibility flags as false", async () => {
    getMetaEntityMock.mockResolvedValue({
      id: "entity-1",
      code: "nomenclature",
      attributes: [],
      sections: [{ id: "sec-1", code: "main", name: "Основные" }],
    });
    prismaMock.metaAttribute.create.mockResolvedValue({ id: "attr-1" });

    const formData = new FormData();
    formData.set("code", "brand");
    formData.set("name", "Бренд");
    formData.set("type", "string");
    formData.set("section", "main");

    await addMetaAttribute("nomenclature", formData);

    expect(prismaMock.metaAttribute.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        required: false,
        formVisible: false,
        listVisible: false,
      }),
    });
  });

  it("stores checked visibility flags as true", async () => {
    getMetaEntityMock.mockResolvedValue({
      id: "entity-1",
      code: "nomenclature",
      attributes: [],
      sections: [{ id: "sec-1", code: "main", name: "Основные" }],
    });
    prismaMock.metaAttribute.create.mockResolvedValue({ id: "attr-1" });

    const formData = new FormData();
    formData.set("code", "brand");
    formData.set("name", "Бренд");
    formData.set("type", "string");
    formData.set("section", "main");
    formData.set("required", "on");
    formData.set("formVisible", "on");
    formData.set("listVisible", "on");

    await addMetaAttribute("nomenclature", formData);

    expect(prismaMock.metaAttribute.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        required: true,
        formVisible: true,
        listVisible: true,
      }),
    });
  });
});
