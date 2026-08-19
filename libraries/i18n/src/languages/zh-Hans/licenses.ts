import type { LicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";

type LicenseOptionTranslation = { readonly label: string };
const { forms: licenseTerms } = zhHansTerminology.license;

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
	"pdm-1.0": { label: `知识共享 ${verbatimTerms.cc.value} ${verbatimTerms.pdm.value} 1.0 通用` },
	"rezics-unit-content-license-v1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1.value,
	},
} satisfies Readonly<Record<LicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "未指定",
	exclusiveSelectionHint:
		"新选“保留所有权利”时，会先清掉这次新勾的其他公开授权；后端已有的组合会原样保留。",
	residualRightsNotice:
		"“保留所有权利”只覆盖其他授权未明确授出的剩余权利，不会覆盖或撤销同时列出的授权。",
	viewTerms: `查看${licenseTerms.inline}`,
	declarationNotice: `这些选项只记录声明。其法律效力取决于声明人是否拥有必要权利；${verbatimTerms.rezics.value} 不对此进行核验。`,
	options,
	affirmativeAcknowledgement: {
		confirmationLabel: `我已阅读并同意 ${verbatimTerms.rezicsUnitContentLicenseV1.value}，并确认我有权就此内容授予该${zhHansTerminology.license.forms.label}。`,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
