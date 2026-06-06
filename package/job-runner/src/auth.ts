export const INTERNAL_SECRET_HEADER = "x-internal-secret";

type HeaderInput = Headers | Record<string, string | undefined>;

function getHeader(headers: HeaderInput, name: string) {
  if (headers instanceof Headers) return headers.get(name);
  return headers[name] ?? headers[name.toLowerCase()];
}

export function isAuthorized(
  headers: HeaderInput,
  expectedSecret: string,
): boolean {
  const internalHeader = getHeader(headers, INTERNAL_SECRET_HEADER);
  if (internalHeader && internalHeader === expectedSecret) return true;

  const authorization = getHeader(headers, "authorization");
  return authorization === `Bearer ${expectedSecret}`;
}
