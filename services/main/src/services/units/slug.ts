import { InvalidSlug } from "./errors";

export const SlugLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export const SlugAddressMaximumDepth = 16;

declare const slugLabelBrand: unique symbol;
export type SlugLabel = string & { readonly [slugLabelBrand]: true };

export function parseSlugLabel(value: string): SlugLabel {
	if (!SlugLabelPattern.test(value)) throw new InvalidSlug();
	return value as SlugLabel;
}

export function generateSlugLabel(value: string, fallback = "unit"): SlugLabel {
	const suffix = crypto.randomUUID().slice(0, 12);
	const stem = value
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 50);
	const safeFallback = fallback
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 50);
	return parseSlugLabel(`${stem || safeFallback || "unit"}-${suffix}`);
}
