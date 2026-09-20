export function navMenuTabActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(`${href}/`)) return true;
  if (href.startsWith("/catalog/") && pathname.startsWith(href)) return true;
  return false;
}
