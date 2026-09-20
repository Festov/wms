import type { ModuleCode } from "@/lib/modules/registry";

export type MetaEntityKind = "catalog" | "document" | "journal";

export type DocumentHandlerCode =
  | "generic"
  | "inbound"
  | "outbound"
  | "operation";

export type DocumentCapability =
  | "lines"
  | "workflow"
  | "stock"
  | "tsd";

export type LineColumnDef = {
  code: string;
  name: string;
  type?: string;
  systemField?: string;
  refEntityCode?: string;
  required?: boolean;
  listVisible?: boolean;
};

export type LineDefinitionDef = {
  code?: string;
  name: string;
  columns: LineColumnDef[];
};

export const SYSTEM_DOCUMENT_HANDLERS: Record<
  string,
  { handler: DocumentHandlerCode; module: ModuleCode; capabilities: DocumentCapability[] }
> = {
  inbound: {
    handler: "inbound",
    module: "inbound",
    capabilities: ["lines", "workflow", "stock", "tsd"],
  },
  outbound: {
    handler: "outbound",
    module: "outbound",
    capabilities: ["lines", "workflow", "stock", "tsd"],
  },
  operation: {
    handler: "operation",
    module: "operations",
    capabilities: ["lines", "workflow"],
  },
};

export function parseCapabilities(raw: string | null | undefined): DocumentCapability[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is DocumentCapability =>
      v === "lines" || v === "workflow" || v === "stock" || v === "tsd",
    );
  } catch {
    return [];
  }
}

export function serializeCapabilities(caps: DocumentCapability[]): string {
  return JSON.stringify(caps);
}
