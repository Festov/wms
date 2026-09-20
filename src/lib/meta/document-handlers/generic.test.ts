import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  getMetaEntityMock,
  requireCustomDocumentWriteMock,
  saveCatalogFromFormMock,
  listCatalogRowsMock,
  getCatalogRowMock,
} = vi.hoisted(() => ({
  getMetaEntityMock: vi.fn(),
  requireCustomDocumentWriteMock: vi.fn(),
  saveCatalogFromFormMock: vi.fn(),
  listCatalogRowsMock: vi.fn(),
  getCatalogRowMock: vi.fn(),
}));

vi.mock("@/lib/meta/catalog", () => ({
  getMetaEntity: getMetaEntityMock,
  listCatalogRows: listCatalogRowsMock,
  getCatalogRow: getCatalogRowMock,
  saveCatalogFromForm: saveCatalogFromFormMock,
}));

vi.mock("@/lib/permissions/check", () => ({
  requireCustomDocumentWrite: requireCustomDocumentWriteMock,
}));

import {
  createGenericDocumentHandler,
} from "@/lib/meta/document-handlers/generic";

const customEntity = {
  code: "my_doc",
  kind: "document",
  storage: "custom",
  handler: null,
  navItemCode: null,
};

describe("generic document handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMetaEntityMock.mockResolvedValue(customEntity);
  });

  it("creates custom document and returns id", async () => {
    saveCatalogFromFormMock.mockResolvedValue({ id: "row-1" });
    const handler = createGenericDocumentHandler("my_doc");
    const formData = new FormData();
    formData.set("title", "Test");

    const id = await handler.create!(formData);

    expect(requireCustomDocumentWriteMock).toHaveBeenCalledWith(
      "my_doc",
      "custom",
      null,
    );
    expect(saveCatalogFromFormMock).toHaveBeenCalledWith("my_doc", formData);
    expect(id).toBe("row-1");
  });

  it("updates custom document through catalog save", async () => {
    saveCatalogFromFormMock.mockResolvedValue({ id: "row-1" });
    const handler = createGenericDocumentHandler("my_doc");
    const formData = new FormData();

    await handler.update("row-1", formData);

    expect(saveCatalogFromFormMock).toHaveBeenCalledWith(
      "my_doc",
      formData,
      "row-1",
    );
  });

  it("lists and gets custom document rows", async () => {
    listCatalogRowsMock.mockResolvedValue({ rows: [{ id: "row-1" }] });
    getCatalogRowMock.mockResolvedValue({ row: { id: "row-1" } });
    const handler = createGenericDocumentHandler("my_doc", ["lines"]);

    expect(handler.capabilities).toEqual(["lines"]);

    await expect(handler.list({})).resolves.toEqual([{ id: "row-1" }]);
    await expect(handler.get("row-1")).resolves.toEqual({ id: "row-1" });
  });
});
