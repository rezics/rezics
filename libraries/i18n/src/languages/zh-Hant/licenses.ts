import type { LicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

type LicenseOptionTranslation = { readonly label: string };
const { forms: licenseTerms } = zhHantTerminology.license;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `創用 ${verbatimTerms.cc.value} 姓名標示－非商業性－相同方式分享 4.0 國際`,
	},
	"cc-by-sa-4.0": {
		label: `創用 ${verbatimTerms.cc.value} 姓名標示－相同方式分享 4.0 國際`,
	},
	"cc-by-sa-3.0": {
		label: `創用 ${verbatimTerms.cc.value} 姓名標示－相同方式分享 3.0 未本地化`,
	},
	"all-rights-reserved": { label: "保留所有權利" },
	"cc-by-nc-4.0": {
		label: `創用 ${verbatimTerms.cc.value} 姓名標示－非商業性 4.0 國際`,
	},
	"cc-by-4.0": { label: `創用 ${verbatimTerms.cc.value} 姓名標示 4.0 國際` },
	"cc0-1.0": { label: `${verbatimTerms.cc.value}0 1.0 通用` },
	"pdm-1.0": { label: `${verbatimTerms.cc.value} ${verbatimTerms.pdm.value} 1.0 通用` },
	"rezics-unit-content-license-v1-1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1_1.value,
	},
} satisfies Readonly<Record<LicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "未指定",
	exclusiveSelectionHint: `新選「保留所有權利」時，會先清掉這次新勾的其他${licenseTerms.label}；後端已存在的組合會原樣保留。`,
	residualRightsNotice: `「保留所有權利」只覆蓋其他${zhHantTerminology.license.forms.label}未明確授出的剩餘權利，不會覆蓋或撤銷同時列出的${zhHantTerminology.license.forms.label}。`,
	viewTerms: `查看${licenseTerms.inline}`,
	declarationNotice: `這些選項只記錄聲明。其法律效力取決於聲明人是否擁有必要權利；${verbatimTerms.rezics.value} 不會核實該項權利。`,
	options,
	affirmativeAcknowledgement: {
		confirmationLabel: `我已閱讀並同意 ${verbatimTerms.rezicsUnitContentLicenseV1_1.value}。我確認有權就這項內容授予此${licenseTerms.label}，包括翻譯內容，以及將原文與譯文作為一個整體提供付費存取的權利。`,
	},
};
