import type { PublicationLicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { koTerminology } from "@rezics/i18n/terminology/ko";

type LicenseOptionTranslation = { readonly label: string };
const { forms: publicationLicenseTerms } = koTerminology.publicationLicense;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `${verbatimTerms.cc.value} 저작자표시-비영리-동일조건변경허락 4.0 국제`,
	},
	"cc-by-sa-4.0": {
		label: `${verbatimTerms.cc.value} 저작자표시-동일조건변경허락 4.0 국제`,
	},
	"all-rights-reserved": { label: "판권 소유" },
	"cc-by-nc-4.0": {
		label: `${verbatimTerms.cc.value} 저작자표시-비영리 4.0 국제`,
	},
	"cc-by-4.0": {
		label: `${verbatimTerms.cc.value} 저작자표시 4.0 국제`,
	},
	"cc0-1.0": { label: `${verbatimTerms.cc.value} 0 1.0 범용` },
} satisfies Readonly<Record<PublicationLicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "명시되지 않음",
	viewTerms: `${publicationLicenseTerms.inline} 약관 보기`,
	options,
} satisfies typeof import("../zh-Hant/licenses").default;
