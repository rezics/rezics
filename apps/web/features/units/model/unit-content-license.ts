import type { UnitContentLicenseSlug } from "@rezics/license";

const AboutLegalOrigin = "https://about.rezics.com/en/legal";

export function unitContentLicenseHref(slug: UnitContentLicenseSlug): string {
	return `${AboutLegalOrigin}/${slug}`;
}
