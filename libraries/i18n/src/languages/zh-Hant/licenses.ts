import type { PublicationLicenseId, UnitContentLicenseSlug } from "@rezics/license";
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
		none: "無",
		viewTerms: `查看 ${verbatimTerms.rezicsUnitContentLicenseV1.value}`,
		grantNotice: "授權後不可撤銷，並持續適用於這項內容的後續貢獻及所有權移轉。",
		grantedNotice: "這項內容已永久採用此內容授權。",
		contributionNotice: `你在此授權生效期間提交的內容，將依相同條款授權給 ${verbatimTerms.rezics.value}；不需要另行選擇授權。`,
		cancelGrant: "取消",
		confirmGrant: "確認授權",
		options: unitContentOptions,
	},
};
