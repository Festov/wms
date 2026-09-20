import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiErrorMessage, resolveApiLocale } from "@/lib/i18n/api";
import { getApiLocale } from "@/lib/i18n/locale-server";
import type { AppLocale } from "@/i18n/config";
import {
  isModuleEnabled,
  moduleForApiPath,
  type ModuleCode,
} from "@/lib/modules/registry";
import { getModuleFlags } from "@/lib/session";
import { userHasPermission } from "@/lib/permissions/check";
import type { PermissionCode } from "@/lib/permissions/registry";
import { isWeakTsdApiKey } from "@/lib/security/startup-checks";
import { PERMISSION_CODES } from "@/lib/permissions/registry";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function getConfiguredTsdApiKey(): Promise<string | null> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const key = settings?.tsdApiKey?.trim();
  if (!key || isWeakTsdApiKey(key)) return null;
  return key;
}

/** API paths that require inbound OR topology module (putaway). */
function isPutawayApiPath(pathname: string): boolean {
  return (
    pathname === "/api/tsd/putaway" ||
    pathname.startsWith("/api/tsd/putaway/")
  );
}

export async function requireModuleForApi(
  pathname: string,
  locale: AppLocale = "ru",
) {
  const flags = await getModuleFlags();

  if (pathname === "/api/tsd" || pathname.startsWith("/api/tsd/")) {
    if (!flags.tsd) return jsonError(apiErrorMessage("moduleDisabled", locale), 403);
  }

  if (isPutawayApiPath(pathname)) {
    if (flags.inbound || flags.topology) return null;
    return jsonError(apiErrorMessage("moduleDisabled", locale), 403);
  }

  const mod = moduleForApiPath(pathname);
  if (!mod) return null;

  if (!isModuleEnabled(mod, flags)) {
    return jsonError(apiErrorMessage("moduleDisabled", locale), 403);
  }
  return null;
}

export async function requireTsdAuth(request: NextRequest) {
  const locale = resolveApiLocale(request);
  const moduleBlocked = await requireModuleForApi(request.nextUrl.pathname, locale);
  if (moduleBlocked) return moduleBlocked;

  const key =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  const expected = await getConfiguredTsdApiKey();
  if (!expected) {
    return NextResponse.json(
      { error: apiErrorMessage("apiKeyNotConfigured", locale) },
      { status: 503 },
    );
  }

  if (!key || !safeEqual(key, expected)) {
    return NextResponse.json(
      { error: apiErrorMessage("unauthorized", locale) },
      { status: 401 },
    );
  }
  return null;
}

/** Проверка права текущего NextAuth-пользователя для TSD API. */
export async function requireTsdPermission(code: PermissionCode) {
  const locale = await getApiLocale();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return jsonError(apiErrorMessage("loginRequired", locale), 403);
  }
  const ok = await userHasPermission(userId, code);
  if (!ok) {
    return jsonError(apiErrorMessage("forbidden", locale), 403);
  }
  return null;
}

/** Хотя бы одно из перечисленных TSD-прав. */
export async function requireAnyTsdPermission(
  ...codes: PermissionCode[]
) {
  const locale = await getApiLocale();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return jsonError(apiErrorMessage("loginRequired", locale), 403);
  }
  for (const code of codes) {
    if (await userHasPermission(userId, code)) return null;
  }
  return jsonError(apiErrorMessage("forbidden", locale), 403);
}

export async function requireTsdReadAccess() {
  return requireAnyTsdPermission(...PERMISSION_CODES);
}

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

export async function jsonApiError(key: string, status = 400) {
  const locale = await getApiLocale();
  return jsonError(apiErrorMessage(key, locale), status);
}

export type { ModuleCode };
