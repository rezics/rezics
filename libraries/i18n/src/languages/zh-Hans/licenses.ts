import type { PublicationLicenseId, UnitContentLicenseSlug } from "@rezics/license";
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

const unitContentOptions = {
	"rezics-unit-content-license-v1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1.value,
	},
} satisfies Readonly<Record<UnitContentLicenseSlug, LicenseOptionTranslation>>;

export default {
	unspecified: "未指定",
	viewTerms: `查看${publicationLicenseTerms.inline}`,
	options,
	unitContent: {
		none: "无",
		viewTerms: `查看 ${verbatimTerms.rezicsUnitContentLicenseV1.value}`,
		grantNotice: "授予后不可撤销，并继续适用于该内容的后续贡献和所有权转让。",
		grantedNotice: "该内容已永久采用此内容许可。",
		contributionNotice: `你在此许可生效期间提交的内容，将按照相同条款许可给 ${verbatimTerms.rezics.value}；无需另行选择许可。`,
		cancelGrant: "取消",
		confirmGrant: "确认授权",
		options: unitContentOptions,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
