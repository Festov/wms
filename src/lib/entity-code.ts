import { localized } from "@/lib/i18n/errors";

/** Код сущности/справочника: латиница, цифры, подчёркивание. */
export function sanitizeEntityCode(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function isValidEntityCode(code: string) {
  return /^[a-z][a-z0-9_]*$/.test(code);
}

export function assertValidEntityCode(code: string, label = "Код") {
  if (!isValidEntityCode(code)) {
    throw new Error(
      localized("errors.meta.invalidEntityCode", "ru", { label }),
    );
  }
}
