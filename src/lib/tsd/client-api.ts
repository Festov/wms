import { readTsdApiKey } from "@/lib/tsd/client-storage";

export async function tsdFetch(path: string, init?: RequestInit) {
  const key = readTsdApiKey();
  if (!key) {
    throw new Error("Настройте API-ключ ТСД на странице «Устройство».");
  }

  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "cache-control": "no-store",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : `HTTP ${res.status}`,
    );
  }
  return data;
}
