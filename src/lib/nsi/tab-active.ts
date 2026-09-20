export const NSI_HUB = "/nsi";

export function nsiTabActive(pathname: string, href: string) {
  if (href === NSI_HUB) {
    return pathname === NSI_HUB;
  }
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(`${href}/`)) return true;
  if (href.startsWith("/catalog/") && pathname.startsWith(href)) return true;
  return false;
}
