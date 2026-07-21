import type { PublicationLicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

type LicenseOptionTranslation = { readonly label: string };
const { forms: publicationLicenseTerms } = zhHantTerminology.publicationLicense;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `創用 ${verbatimTerms.cc.value} 姓名標示－非商業性－相同方式分享 4.0 國際`,
	},
	"cc-by-sa-4.0": {
		label: `創用 ${verbatimTerms.cc.value} 姓名標示－相同方式分享 4.0 國際`,
	},
	"all-rights-reserved": { label: "保留所有權利" },
	"cc-by-nc-4.0": {
		label: `創用 ${verbatimTerms.cc.value} 姓名標示－非商業性 4.0 國際`,
	},
	"cc-by-4.0": { label: `創用 ${verbatimTerms.cc.value} 姓名標示 4.0 國際` },
	"cc0-1.0": { label: `${verbatimTerms.cc.value}0 1.0 通用` },
} satisfies Readonly<Record<PublicationLicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "未指定",
	viewTerms: `查看${publicationLicenseTerms.inline}`,
	options,
};
