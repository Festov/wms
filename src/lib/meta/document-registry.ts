import type { ModuleCode } from "@/lib/modules/registry";
import type { MetaEntityFull } from "@/lib/meta/catalog";
import {
  parseCapabilities,
  SYSTEM_DOCUMENT_HANDLERS,
  type DocumentCapability,
  type DocumentHandlerCode,
} from "@/lib/meta/types";

export function resolveDocumentHandler(
  entity: Pick<MetaEntityFull, "code" | "storage" | "handler" | "kind">,
): DocumentHandlerCode {
  if (entity.handler) {
    return entity.handler as DocumentHandlerCode;
  }
  const system = SYSTEM_DOCUMENT_HANDLERS[entity.code];
  if (system) return system.handler;
  if (entity.kind === "document" || entity.kind === "journal") return "generic";
  return "generic";
}

export function documentCapabilities(
  entity: Pick<MetaEntityFull, "code" | "capabilities" | "handler" | "kind">,
): DocumentCapability[] {
  const parsed = parseCapabilities(entity.capabilities);
  if (parsed.length > 0) return parsed;
  const system = SYSTEM_DOCUMENT_HANDLERS[entity.code];
  if (system) return system.capabilities;
  return [];
}

export function documentModuleForEntity(entityCode: string): ModuleCode | null {
  const system = SYSTEM_DOCUMENT_HANDLERS[entityCode];
  return system?.module ?? null;
}

export function isSystemDocumentEntity(entityCode: string) {
  return entityCode in SYSTEM_DOCUMENT_HANDLERS;
}

export function documentEntityCodes(): string[] {
  return Object.keys(SYSTEM_DOCUMENT_HANDLERS);
}

export function hasCapability(
  entity: Pick<MetaEntityFull, "code" | "capabilities" | "handler" | "kind">,
  cap: DocumentCapability,
) {
  return documentCapabilities(entity).includes(cap);
}
