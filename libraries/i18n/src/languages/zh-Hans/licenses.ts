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
	"cc-by-sa-3.0": {
		label: `知识共享 ${verbatimTerms.cc.value} 署名—相同方式共享 3.0 未本地化`,
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
		confirmationLabel: `我已阅读并同意 ${verbatimTerms.rezicsUnitContentLicenseV1.value}，并确认我有权就此内容授予该许可。`,
		noneNotice:
			"不会授予内容许可。只有在这项作品仅用于索引资料，且不会发布或托管作品内容时，才应选择“无”。",
		noneConfirmationTitle: `不授予 ${verbatimTerms.rezics.value} 内容许可？`,
		noneConfirmationNotice: `如果你要在 ${verbatimTerms.rezics.value} 发布或托管作品内容，应保留内容许可。如果这个条目只用于索引作品资料，则不需要许可。没有内容许可时，请勿在这个条目中发布作品正文或其他受版权保护的内容。`,
		keepLicense: "保留许可",
		confirmNone: "改为无许可",
		publicWorkNotice: `公共作品不会向 ${verbatimTerms.rezics.value} 授予内容许可，应仅用于收录作品的索引资料。`,
		grantedNotice: "该内容已永久采用此内容许可。",
		contributionNotice: `你在此许可生效期间提交的内容，将按照相同条款许可给 ${verbatimTerms.rezics.value}；无需另行选择许可。`,
		cancelGrant: "取消",
		confirmGrant: "确认授权",
		options: unitContentOptions,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
