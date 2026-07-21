import {
	isSlugLabel,
	SlugAddressMaximumDepth,
	SlugLabelPattern,
	type SlugLabel,
} from "@rezics/slug";

import { InvalidSlug } from "./errors";

export { SlugAddressMaximumDepth, SlugLabelPattern, type SlugLabel };

export function parseSlugLabel(value: string): SlugLabel {
	if (!isSlugLabel(value)) throw new InvalidSlug();
	return value;
}
