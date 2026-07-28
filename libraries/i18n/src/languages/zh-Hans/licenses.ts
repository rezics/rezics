import type { PublicationLicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";

type LicenseOptionTranslation = { readonly label: string };
const { forms: publicationLicenseTerms } = zhHansTerminology.publicationLicense;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `知识共享 ${verbatimTerms.cc.value} 署名—非商业性使用—相同方式共享 4.0 国际`,
	},
	"cc-by-sa-4.0": {
		label: `知识共享 ${verbatimTerms.cc.value} 署名—相同方式共享 4.0 国际`,
	},
	"all-rights-reserved": { label: "保留所有权利" },
	"cc-by-nc-4.0": {
		label: `知识共享 ${verbatimTerms.cc.value} 署名—非商业性使用 4.0 国际`,
	},
	"cc-by-4.0": { label: `知识共享 ${verbatimTerms.cc.value} 署名 4.0 国际` },
	"cc0-1.0": { label: `知识共享 ${verbatimTerms.cc.value}0 1.0 通用` },
} satisfies Readonly<Record<PublicationLicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "未指定",
	viewTerms: `查看${publicationLicenseTerms.inline}`,
	options,
} satisfies typeof import("../zh-Hant/licenses").default;
