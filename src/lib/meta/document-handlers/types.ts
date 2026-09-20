import type { DocumentCapability, DocumentHandlerCode } from "@/lib/meta/types";

export type DocumentListFilters = {
  status?: string[];
  kind?: string[];
  type?: string;
  q?: string;
};

export type DocumentHandler = {
  entityCode: string;
  handler: DocumentHandlerCode;
  capabilities: DocumentCapability[];
  list: (filters: DocumentListFilters) => Promise<unknown[]>;
  get: (id: string) => Promise<unknown | null>;
  create?: (formData: FormData) => Promise<string>;
  update: (id: string, formData: FormData) => Promise<void>;
};
