import type { AppLocale } from "@/i18n/config";
import { translateSyncWithFallback } from "@/lib/i18n/sync";

export const INBOUND_KINDS = [
  "PLANNED",
  "URGENT",
  "RETURN",
  "TRANSFER",
] as const;

export type InboundKindCode = (typeof INBOUND_KINDS)[number];

export function inboundKindLabel(
  kind: string | null | undefined,
  locale: AppLocale = "ru",
) {
  if (!kind) return "—";
  return translateSyncWithFallback(
    `documents.inboundKinds.${kind}`,
    kind,
    locale,
  );
}

export function parseInboundKindList(raw?: string) {
  if (!raw?.trim()) return undefined;
  const kinds = raw
    .split(",")
    .map((s) => s.trim())
    .filter((k): k is InboundKindCode =>
      INBOUND_KINDS.includes(k as InboundKindCode),
    );
  return kinds.length > 0 ? kinds : undefined;
}

export function formatInboundKindFilterLabel(
  kinds: InboundKindCode[],
  locale: AppLocale = "ru",
) {
  return kinds.map((kind) => inboundKindLabel(kind, locale)).join(", ");
}

export function parseInboundKind(value: string): InboundKindCode {
  const code = value.trim().toUpperCase();
  if (INBOUND_KINDS.includes(code as InboundKindCode)) {
    return code as InboundKindCode;
  }
  return "PLANNED";
}
