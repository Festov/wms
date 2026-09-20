import { prisma } from "@/lib/db";
import { locationTypeLabel } from "@/lib/format";
import { findActiveLocationIdByCodeOrBarcode } from "@/lib/ci-lookup";
import { getApiLocale } from "@/lib/i18n/locale-server";
import { localized } from "@/lib/i18n/errors";

export type LocationPurpose = "receive" | "putaway" | "pick" | "any";

const PURPOSE_TYPES: Record<
  Exclude<LocationPurpose, "any">,
  Array<"RECEIVING" | "STORAGE" | "SHIPPING" | "QUARANTINE">
> = {
  receive: ["RECEIVING"],
  putaway: ["STORAGE"],
  pick: ["STORAGE", "SHIPPING"],
};

const PURPOSE_LABEL_KEYS: Record<
  Exclude<LocationPurpose, "any">,
  string
> = {
  receive: "errors.api.locationPurposeReceive",
  putaway: "errors.api.locationPurposePutaway",
  pick: "errors.api.locationPurposePick",
};

export type ResolvedLocation = {
  id: string;
  code: string;
  name: string;
  type: string;
  barcode: string | null;
  zone: { id: string; code: string; name: string; type: string } | null;
};

export type ResolveTsdLocationResult =
  | { ok: true; location: ResolvedLocation }
  | { ok: false; error: string; notFound?: boolean };

/**
 * Находит активную ячейку по коду/штрихкоду и проверяет тип зоны/ячейки
 * под операцию (приёмка → RECEIVING и т.д.).
 * Код/штрихкод сравниваются без учёта регистра.
 */
export async function resolveTsdLocation(
  codeOrBarcode: string,
  purpose: LocationPurpose = "any",
): Promise<ResolveTsdLocationResult> {
  const locale = await getApiLocale();
  const code = codeOrBarcode.trim();
  if (!code) {
    return {
      ok: false,
      error: localized("errors.api.locationRequired", locale),
    };
  }

  const id = await findActiveLocationIdByCodeOrBarcode(code);
  const location = id
    ? await prisma.location.findFirst({
        where: { id, isActive: true },
        include: { zone: true },
      })
    : null;

  if (!location) {
    return {
      ok: false,
      error: localized("errors.api.locationNotFoundOrInactive", locale),
      notFound: true,
    };
  }

  const effectiveType = location.zone?.type ?? location.type;

  if (purpose !== "any") {
    const allowed = PURPOSE_TYPES[purpose];
    if (!allowed.includes(effectiveType)) {
      const need = allowed.map((t) => locationTypeLabel(t, locale)).join(" / ");
      const got = locationTypeLabel(effectiveType, locale);
      return {
        ok: false,
        error: localized("errors.api.locationWrongType", locale, {
          code: location.code,
          got,
          purpose: localized(PURPOSE_LABEL_KEYS[purpose], locale),
          need,
        }),
      };
    }
  }

  return {
    ok: true,
    location: {
      id: location.id,
      code: location.code,
      name: location.name,
      type: effectiveType,
      barcode: location.barcode,
      zone: location.zone
        ? {
            id: location.zone.id,
            code: location.zone.code,
            name: location.zone.name,
            type: location.zone.type,
          }
        : null,
    },
  };
}
