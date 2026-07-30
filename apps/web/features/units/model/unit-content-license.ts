import type { UnitContentLicenseSlug } from "@rezics/license";

const AboutLegalOrigin = "https://about.rezics.com/legal";

export function unitContentLicenseHref(slug: UnitContentLicenseSlug): string {
	return `${AboutLegalOrigin}/${slug}`;
}
