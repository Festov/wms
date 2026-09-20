"use client";

import { useEffect } from "react";

/**
 * Unregisters every service worker and deletes app caches.
 * The WMS/TSD app must not depend on browser HTTP cache.
 */
export async function purgeBrowserAppCache() {
  if (typeof window === "undefined") return;

  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  }

  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

/** Mount once on ТСД (and main shell) to keep SW/cache cleared. */
export function DisableBrowserCache() {
  useEffect(() => {
    void purgeBrowserAppCache().catch(() => {});
  }, []);

  return null;
}
