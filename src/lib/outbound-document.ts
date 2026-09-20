import type { AppLocale } from "@/i18n/config";
import { translateSyncWithFallback } from "@/lib/i18n/sync";

export const OUTBOUND_KINDS = [
  "PLANNED",
  "URGENT",
  "RETURN",
  "TRANSFER",
] as const;

export type OutboundKindCode = (typeof OUTBOUND_KINDS)[number];

export function outboundKindLabel(
  kind: string | null | undefined,
  locale: AppLocale = "ru",
) {
  if (!kind) return "—";
  return translateSyncWithFallback(
    `documents.outboundKinds.${kind}`,
    kind,
    locale,
  );
}

export function parseOutboundKindList(raw?: string) {
  if (!raw?.trim()) return undefined;
  const kinds = raw
    .split(",")
    .map((s) => s.trim())
    .filter((k): k is OutboundKindCode =>
      OUTBOUND_KINDS.includes(k as OutboundKindCode),
    );
  return kinds.length > 0 ? kinds : undefined;
}

export function formatOutboundKindFilterLabel(
  kinds: OutboundKindCode[],
  locale: AppLocale = "ru",
) {
  return kinds.map((kind) => outboundKindLabel(kind, locale)).join(", ");
}

export function parseOutboundKind(value: string): OutboundKindCode {
  const code = value.trim().toUpperCase();
  if (OUTBOUND_KINDS.includes(code as OutboundKindCode)) {
    return code as OutboundKindCode;
  }
  return "PLANNED";
}
