export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "owner";
}

export function isOwnerRole(role: string | null | undefined): boolean {
  return role === "owner";
}

export function buildCurrentRedirectPath(location: {
  pathname?: string;
  searchStr?: string;
  hash?: string;
  href?: string;
}): string {
  if (typeof location.pathname === "string") {
    return `${location.pathname}${location.searchStr ?? ""}${location.hash ?? ""}`;
  }

  if (typeof location.href === "string") {
    return sanitizeRedirectPath(location.href);
  }

  return "/";
}

export function sanitizeRedirectPath(to: unknown): string {
  if (typeof to !== "string") return "/";
  if (!to.startsWith("/") || to.startsWith("//")) return "/";
  return to;
}
