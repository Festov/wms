import { loginAction } from "@/lib/auth-actions";
import {
  Field,
  Panel,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { getTranslations } from "next-intl/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/";
  const showError = params.error === "credentials";
  const t = await getTranslations("login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-4">
      <div className="w-full max-w-md space-y-4">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          WMS
        </p>
        <Panel title={t("title")}>
          <form action={loginAction} className="space-y-3">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Field label={t("loginLabel")}>
              <input
                className={inputClass}
                name="login"
                type="text"
                autoComplete="username"
                required
                autoFocus
              />
            </Field>
            <Field label={t("passwordLabel")}>
              <input
                className={inputClass}
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            {showError ? (
              <p className="text-sm text-rose-700">{t("invalidCredentials")}</p>
            ) : null}
            <button className={buttonClass} type="submit">
              {t("submit")}
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
