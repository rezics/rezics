const UNIT_ROUTE_PREFIXES = [
  "/unit",
  "/book",
  "/excerpt",
  "/shelf",
  "/chapter",
  "/review",
  "/remark",
  "/tag",
  "/realm",
];

export function parseAppRoute(input: string): { unitId: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let pathname = trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      pathname = new URL(trimmed).pathname;
    }
  } catch {
    return null;
  }

  if (!pathname.startsWith("/")) return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const prefix = `/${segments[0]}`;
  if (!UNIT_ROUTE_PREFIXES.includes(prefix)) return null;

  const unitId = segments[1];
  if (!unitId) return null;

  return { unitId };
}
