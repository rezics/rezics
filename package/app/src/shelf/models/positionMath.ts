import { generateKeyBetween } from "@rezics/api/shared/fractional-index";

export function appendAfter(last: string | undefined): string {
  return generateKeyBetween(last, undefined);
}

export function prependBefore(first: string | undefined): string {
  return generateKeyBetween(undefined, first);
}

export function betweenNeighbors(
  before: string | undefined,
  after: string | undefined,
): string {
  return generateKeyBetween(before, after);
}
