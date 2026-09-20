import { jsonError } from "@/lib/tsd-auth";
import { apiErrorMessage } from "@/lib/i18n/api";
import { getApiLocale } from "@/lib/i18n/locale-server";

/** Обёртка для TSD API: бизнес-ошибки → 400, неожиданные → 500. */
export async function runTsdRoute(
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (e) {
    const locale = await getApiLocale();
    const message =
      e instanceof Error ? e.message : apiErrorMessage("internal", locale);
    const status = /не найден|недостаточно|заполните|выберите|некорректн|not found|insufficient|fill in|select|invalid/i.test(
      message,
    )
      ? 400
      : 500;
    return jsonError(message, status);
  }
}
