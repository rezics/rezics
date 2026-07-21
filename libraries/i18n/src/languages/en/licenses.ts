import type { PublicationLicenseId } from "@rezics/license";
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

export default {
	unspecified: "Unspecified",
	viewTerms: `View ${publicationLicenseTerms.inline} terms`,
	options,
} satisfies typeof import("../zh-Hant/licenses").default;
