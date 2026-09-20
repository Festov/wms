import { describe, expect, it } from "vitest";
import {
  documentCapabilities,
  documentModuleForEntity,
  isSystemDocumentEntity,
  resolveDocumentHandler,
} from "@/lib/meta/document-registry";
import { serializeCapabilities } from "@/lib/meta/types";

describe("document-registry", () => {
  it("resolves system document handlers", () => {
    expect(
      resolveDocumentHandler({
        code: "inbound",
        storage: "system",
        handler: "inbound",
        kind: "document",
      }),
    ).toBe("inbound");
    expect(documentModuleForEntity("inbound")).toBe("inbound");
    expect(isSystemDocumentEntity("inbound")).toBe(true);
  });

  it("defaults custom documents to generic", () => {
    expect(
      resolveDocumentHandler({
        code: "my_doc",
        storage: "custom",
        handler: null,
        kind: "document",
      }),
    ).toBe("generic");
  });

  it("parses capabilities from entity", () => {
    expect(
      documentCapabilities({
        code: "inbound",
        handler: "inbound",
        kind: "document",
        capabilities: serializeCapabilities(["lines", "workflow"]),
      }),
    ).toEqual(["lines", "workflow"]);
  });
});
