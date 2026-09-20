const WEAK_AUTH_SECRETS = new Set([
  "",
  "change-me-in-production",
  "changeme",
  "secret",
]);

const WEAK_TSD_KEYS = new Set(["", "tsd-demo-key", "demo", "change-me"]);

export function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;

  const authSecret =
    process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  if (WEAK_AUTH_SECRETS.has(authSecret.trim())) {
    throw new Error(
      "AUTH_SECRET must be set to a strong random value in production (openssl rand -base64 32).",
    );
  }
}

export function isWeakTsdApiKey(key: string | null | undefined): boolean {
  const normalized = (key ?? "").trim();
  return WEAK_TSD_KEYS.has(normalized);
}
