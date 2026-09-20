import type { AppLocale } from "@/i18n/config";
import { resolveLabelsJson, resolveStatusLabel } from "@/lib/i18n/resolve-label";

export type StatusAppearance = {
  name: string;
  bg: string;
  fg: string;
  border: string;
};

export type StatusCatalog = Record<string, StatusAppearance>;

export const DEFAULT_STATUS_APPEARANCE: Record<
  string,
  Omit<StatusAppearance, "name">
> = {
  DRAFT: { bg: "#fff7ed", fg: "#9a3412", border: "#fdba74" },
  RELEASED: { bg: "#eff6ff", fg: "#1d4ed8", border: "#93c5fd" },
  ACCEPTED: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
  PLACED: { bg: "#ecfdf5", fg: "#065f46", border: "#6ee7b7" },
  COMPLETED: { bg: "#ecfdf5", fg: "#065f46", border: "#6ee7b7" },
  POSTED: { bg: "#ecfdf5", fg: "#065f46", border: "#6ee7b7" },
  CANCELLED: { bg: "#fff1f2", fg: "#9f1239", border: "#fda4af" },
  AVAILABLE: { bg: "#eff6ff", fg: "#1d4ed8", border: "#93c5fd" },
};

const FALLBACK_APPEARANCE: Omit<StatusAppearance, "name"> = {
  bg: "var(--surface)",
  fg: "var(--muted)",
  border: "var(--line)",
};

export function resolveStatusAppearance(
  code: string,
  row?: {
    name?: string | null;
    labelsJson?: string | null;
    colorBg?: string | null;
    colorFg?: string | null;
    colorBorder?: string | null;
  } | null,
  locale: AppLocale = "ru",
): StatusAppearance {
  const defaults = DEFAULT_STATUS_APPEARANCE[code] ?? FALLBACK_APPEARANCE;
  const baseName = resolveStatusLabel(code, row?.name, locale);
  return {
    name: resolveLabelsJson(row?.labelsJson, baseName, locale),
    bg: row?.colorBg?.trim() || defaults.bg,
    fg: row?.colorFg?.trim() || defaults.fg,
    border: row?.colorBorder?.trim() || defaults.border,
  };
}

export function statusLabelFromCatalog(
  catalog: StatusCatalog | undefined,
  code: string,
) {
  return catalog?.[code]?.name ?? code;
}
