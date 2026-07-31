import type { PublicationLicenseId, UnitContentLicenseSlug } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { enTerminology } from "@rezics/i18n/terminology/en";

type LicenseOptionTranslation = { readonly label: string };
const { forms: publicationLicenseTerms } = enTerminology.publicationLicense;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `${verbatimTerms.cc.value} Attribution–NonCommercial–ShareAlike 4.0 International`,
	},
	"cc-by-sa-4.0": {
		label: `${verbatimTerms.cc.value} Attribution–ShareAlike 4.0 International`,
	},
	"all-rights-reserved": { label: "All rights reserved" },
	"cc-by-nc-4.0": {
		label: `${verbatimTerms.cc.value} Attribution–NonCommercial 4.0 International`,
	},
	"cc-by-4.0": {
		label: `${verbatimTerms.cc.value} Attribution 4.0 International`,
	},
	"cc0-1.0": { label: `${verbatimTerms.cc.value}0 1.0 Universal` },
} satisfies Readonly<Record<PublicationLicenseId, LicenseOptionTranslation>>;

const unitContentOptions = {
	"rezics-unit-content-license-v1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1.value,
	},
} satisfies Readonly<Record<UnitContentLicenseSlug, LicenseOptionTranslation>>;

export default {
	unspecified: "Unspecified",
	viewTerms: `View ${publicationLicenseTerms.inline} terms`,
	options,
	unitContent: {
		none: "None",
		viewTerms: `View ${verbatimTerms.rezicsUnitContentLicenseV1.value}`,
		grantNotice:
			"Once granted, this license cannot be revoked and continues to cover later contributions and ownership transfers.",
		grantedNotice: "This content license has been permanently granted for this content.",
		contributionNotice: `Content you contribute while this license applies is licensed to ${verbatimTerms.rezics.value} under the same terms; no separate license selection is required.`,
		cancelGrant: "Cancel",
		confirmGrant: "Grant license",
		options: unitContentOptions,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
