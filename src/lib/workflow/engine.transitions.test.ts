import { describe, expect, it, vi, beforeEach } from "vitest";

const workflowRow = {
  id: "wf-1",
  code: "inbound",
  name: "Приёмка",
  entityCode: "inbound",
  appliesTo: "document",
  transitions: [
    {
      id: "tr-1",
      fromStatusCode: "DRAFT",
      toStatusCode: "RELEASED",
      guardConfig: JSON.stringify({ guard: "hasLines" }),
      triggers: [
        {
          id: "tg-1",
          kind: "manual",
          label: "К исполнению",
          config: null,
          requiredPerm: null,
          sortOrder: 0,
        },
      ],
    },
    {
      id: "tr-2",
      fromStatusCode: "DRAFT",
      toStatusCode: "CANCELLED",
      guardConfig: null,
      triggers: [
        {
          id: "tg-2",
          kind: "manual",
          label: "Отменить",
          config: null,
          requiredPerm: null,
          sortOrder: 0,
        },
      ],
    },
  ],
};

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    statusWorkflow: {
      findFirst: findFirstMock,
    },
  },
}));

vi.mock("@/lib/workflow/seed", () => ({
  ensureStatusWorkflows: vi.fn(),
}));

import {
  getManualTransitions,
  isTransitionAllowed,
} from "@/lib/workflow/engine";

describe("workflow engine transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstMock.mockResolvedValue(workflowRow);
  });

  it("returns manual transitions with labels", async () => {
    const transitions = await getManualTransitions("inbound", "DRAFT", {
      documentId: "doc-1",
      lineCount: 2,
      entityCode: "inbound",
    });

    expect(transitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toStatusCode: "RELEASED",
          label: "К исполнению",
        }),
        expect.objectContaining({
          toStatusCode: "CANCELLED",
          label: "Отменить",
        }),
      ]),
    );
  });

  it("blocks transition when hasLines guard fails", async () => {
    const allowed = await isTransitionAllowed(
      "inbound",
      "DRAFT",
      "RELEASED",
      "manual",
      { documentId: "doc-1", lineCount: 0, entityCode: "inbound" },
    );
    expect(allowed).toBe(false);
  });

  it("allows transition when guard passes", async () => {
    const allowed = await isTransitionAllowed(
      "inbound",
      "DRAFT",
      "RELEASED",
      "manual",
      { documentId: "doc-1", lineCount: 1, entityCode: "inbound" },
    );
    expect(allowed).toBe(true);
  });
});
