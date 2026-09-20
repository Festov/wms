import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  prismaMock,
  requireModuleMock,
  updateInboundDocumentFromFormMock,
} = vi.hoisted(() => ({
  prismaMock: {
    inboundDocument: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  requireModuleMock: vi.fn(),
  updateInboundDocumentFromFormMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/session", () => ({
  requireModule: requireModuleMock,
}));

vi.mock("@/lib/meta/document-handlers/inbound-save", () => ({
  updateInboundDocumentFromForm: updateInboundDocumentFromFormMock,
}));

import { inboundDocumentHandler } from "@/lib/meta/document-handlers/inbound";

describe("inboundDocumentHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes system handler metadata", () => {
    expect(inboundDocumentHandler.entityCode).toBe("inbound");
    expect(inboundDocumentHandler.handler).toBe("inbound");
    expect(inboundDocumentHandler.capabilities).toContain("lines");
    expect(inboundDocumentHandler.capabilities).toContain("tsd");
  });

  it("lists inbound documents with status filter", async () => {
    prismaMock.inboundDocument.findMany.mockResolvedValue([{ id: "doc-1" }]);

    const rows = await inboundDocumentHandler.list({ status: ["RELEASED"] });

    expect(requireModuleMock).toHaveBeenCalledWith("inbound");
    expect(prismaMock.inboundDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ["RELEASED"] } },
      }),
    );
    expect(rows).toEqual([{ id: "doc-1" }]);
  });

  it("gets inbound document by id", async () => {
    prismaMock.inboundDocument.findUnique.mockResolvedValue({ id: "doc-1" });

    const row = await inboundDocumentHandler.get("doc-1");

    expect(requireModuleMock).toHaveBeenCalledWith("inbound");
    expect(prismaMock.inboundDocument.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "doc-1" } }),
    );
    expect(row).toEqual({ id: "doc-1" });
  });

  it("updates inbound document through save helper", async () => {
    const formData = new FormData();
    formData.set("supplierId", "sup-1");

    await inboundDocumentHandler.update("doc-1", formData);

    expect(updateInboundDocumentFromFormMock).toHaveBeenCalledWith(
      "doc-1",
      formData,
    );
  });

  it("rejects create and points to module action", async () => {
    await expect(
      inboundDocumentHandler.create?.(new FormData()),
    ).rejects.toThrow("createInboundDocument");
  });
});
