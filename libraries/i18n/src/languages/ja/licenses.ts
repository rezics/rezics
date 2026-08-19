import type { LicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { jaTerminology } from "@rezics/i18n/terminology/ja";

type LicenseOptionTranslation = { readonly label: string };
const { forms: licenseTerms } = jaTerminology.license;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `${verbatimTerms.cc.value} 表示–非営利–継承 4.0 国際`,
	},
	"cc-by-sa-4.0": {
		label: `${verbatimTerms.cc.value} 表示–継承 4.0 国際`,
	},
	"cc-by-sa-3.0": {
		label: `${verbatimTerms.cc.value} 表示–継承 3.0 非移植`,
	},
	"all-rights-reserved": { label: "無断複写・転載を禁ず" },
	"cc-by-nc-4.0": {
		label: `${verbatimTerms.cc.value} 表示–非営利 4.0 国際`,
	},
	"cc-by-4.0": {
		label: `${verbatimTerms.cc.value} 表示 4.0 国際`,
	},
	"cc0-1.0": { label: `${verbatimTerms.cc.value} 0 1.0 ユニバーサル` },
	"rezics-unit-content-license-v1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1.value,
	},
} satisfies Readonly<Record<LicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "未指定",
	exclusiveSelectionHint: `「無断複写・転載を禁ず」を新たに選ぶと、今回新たに選んだ他の${licenseTerms.label}はいったん外れます。すでに保存されている組み合わせはそのまま残ります。`,
	residualRightsNotice: `「無断複写・転載を禁ず」は、同時に示された他の${jaTerminology.license.forms.label}が明示的に与えていない残りの権利だけを対象にします。それらの${jaTerminology.license.forms.label}を覆したり取り消したりはしません。`,
	viewTerms: `${licenseTerms.inline} 利用規約を見る`,
	options,
	affirmativeAcknowledgement: {
		confirmationLabel: `${verbatimTerms.rezicsUnitContentLicenseV1.value}を読み、同意したうえで、このコンテンツについてこの${jaTerminology.license.forms.label}を付与する権限があることを確認します。`,
		profileOwnedOnlyNotice: `公共作品は ${verbatimTerms.rezics.value} にコンテンツ${jaTerminology.license.forms.label}を付与せず、作品の索引情報のみを収録するために使用します。`,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
