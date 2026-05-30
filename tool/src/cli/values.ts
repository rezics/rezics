export function repeatedCsv(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.flatMap((item) =>
    item
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
}
