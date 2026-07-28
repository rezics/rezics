import type { PublicationLicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { jaTerminology } from "@rezics/i18n/terminology/ja";

type LicenseOptionTranslation = { readonly label: string };
const { forms: publicationLicenseTerms } = jaTerminology.publicationLicense;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `${verbatimTerms.cc.value} 表示–非営利–継承 4.0 国際`,
	},
	"cc-by-sa-4.0": {
		label: `${verbatimTerms.cc.value} 表示–継承 4.0 国際`,
	},
	"all-rights-reserved": { label: "無断複写・転載を禁ず" },
	"cc-by-nc-4.0": {
		label: `${verbatimTerms.cc.value} 表示–非営利 4.0 国際`,
	},
	"cc-by-4.0": {
		label: `${verbatimTerms.cc.value} 表示 4.0 国際`,
	},
	"cc0-1.0": { label: `${verbatimTerms.cc.value} 0 1.0 ユニバーサル` },
} satisfies Readonly<Record<PublicationLicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "未指定",
	viewTerms: `${publicationLicenseTerms.inline} 利用規約を見る`,
	options,
} satisfies typeof import("../zh-Hant/licenses").default;
