export function getRequestOrigin(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");

  if (host) {
    return `${forwardedProto ?? "http"}://${host}`;
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return "http://localhost";
  }
}

export function toAbsoluteUrl(url: string, origin: string): string {
  try {
    return new URL(url).toString();
  } catch {
    return new URL(url, origin).toString();
  }
}
