import type { NextRequest } from "next/server";
import {
  defaultLocale,
  isAppLocale,
  LOCALE_COOKIE,
  type AppLocale,
} from "@/i18n/config";
import { translateSync } from "@/lib/i18n/sync";

function localeFromAcceptLanguage(header: string | null): AppLocale | null {
  const value = header?.toLowerCase() ?? "";
  if (value.includes("en")) return "en";
  if (value.includes("ru")) return "ru";
  return null;
}

function localeFromCookieHeader(cookieHeader: string | null): AppLocale | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`),
  );
  const value = match?.[1];
  return isAppLocale(value) ? value : null;
}

export function resolveApiLocaleFromHeaders(
  getHeader: (name: string) => string | null,
): AppLocale {
  return (
    localeFromAcceptLanguage(getHeader("accept-language")) ??
    localeFromCookieHeader(getHeader("cookie")) ??
    defaultLocale
  );
}

export function resolveApiLocale(request: NextRequest): AppLocale {
  return resolveApiLocaleFromHeaders((name) => request.headers.get(name));
}

export function apiErrorMessage(
  key: string,
  locale: AppLocale = defaultLocale,
  values?: Record<string, string | number>,
): string {
  let message = translateSync(`errors.api.${key}`, locale);
  if (values) {
    for (const [name, value] of Object.entries(values)) {
      message = message.replace(`{${name}}`, String(value));
    }
  }
  return message;
}

export function integrationErrorMessage(
  key: string,
  locale: AppLocale = defaultLocale,
  values?: Record<string, string | number>,
): string {
  let message = translateSync(`errors.integration.${key}`, locale);
  if (values) {
    for (const [name, value] of Object.entries(values)) {
      message = message.replace(`{${name}}`, String(value));
    }
  }
  return message;
}
