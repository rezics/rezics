import { type UnitHrefInput, unitHref } from "./unitHref";

/**
 * React-side sugar over {@link unitHref}. Pass a unit object directly and get
 * the computed href back. The pure function is the contract; this hook exists
 * only so call sites can write `<Link to={useUnitHref(post.author)}>` without
 * destructuring.
 */
export function useUnitHref(input: UnitHrefInput): string {
  return unitHref(input);
}
