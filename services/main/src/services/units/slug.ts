import { InvalidSlug } from "./errors";

export const SlugLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Current backend-only address depth policy, including the top-level namespace.
 *
 * @remarks
 * The storage model remains recursive. This bound limits current resolver and
 * mutation work without promising that the frontend renders slug routes.
 *
 * @todo
 * Re-evaluate the limit together with the public non-Profile slug contract.
 */
export const SlugAddressMaximumDepth = 3;

declare const slugLabelBrand: unique symbol;
export type SlugLabel = string & { readonly [slugLabelBrand]: true };

export function parseSlugLabel(value: string): SlugLabel {
	if (!SlugLabelPattern.test(value)) throw new InvalidSlug();
	return value as SlugLabel;
}
