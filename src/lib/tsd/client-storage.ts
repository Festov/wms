export const TSD_API_KEY_STORAGE = "wms.tsd.apiKey";
export const TSD_DEVICE_KEY_STORAGE = "wms.tsd.deviceKey";
export const TSD_DEVICE_NAME_STORAGE = "wms.tsd.deviceName";

export function readTsdApiKey(): string | null {
  if (typeof window === "undefined") return null;
  const key = localStorage.getItem(TSD_API_KEY_STORAGE)?.trim();
  return key || null;
}

export function requireTsdApiKey(): string {
  const key = readTsdApiKey();
  if (!key) {
    throw new Error("TSD API key is not configured on this device.");
  }
  return key;
}
