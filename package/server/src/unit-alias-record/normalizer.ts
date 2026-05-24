const SEPARATOR_PATTERN = /[\u2010-\u2015\u2212\u30fc]+/g;
const WHITESPACE_PATTERN = /\s+/g;

export function normalizeUnitAliasValue(value: string): string {
  return value
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(SEPARATOR_PATTERN, "-")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();
}

export function trimUnitAliasValue(value: string): string {
  return value.trim().normalize("NFKC");
}
