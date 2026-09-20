/** Собирает URL создания с возвратом на текущую страницу. */
export function createHrefWithReturn(
  createPath: string,
  returnTo: string,
  extra?: Record<string, string>,
) {
  const params = new URLSearchParams(extra);
  if (returnTo.startsWith("/")) {
    params.set("returnTo", returnTo);
  }
  const qs = params.toString();
  return qs ? `${createPath}?${qs}` : createPath;
}

export function safeReturnTo(raw: string | null | undefined, fallback: string) {
  const v = String(raw ?? "").trim();
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  return fallback;
}

export const CREATE_OPTION_VALUE = "__create__";
export const SHOW_ALL_OPTION_VALUE = "__show_all__";
