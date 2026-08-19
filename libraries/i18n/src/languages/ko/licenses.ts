import type { LicenseId } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { koTerminology } from "@rezics/i18n/terminology/ko";

type LicenseOptionTranslation = { readonly label: string };
const { forms: licenseTerms } = koTerminology.license;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `${verbatimTerms.cc.value} 저작자표시-비영리-동일조건변경허락 4.0 국제`,
	},
	"cc-by-sa-4.0": {
		label: `${verbatimTerms.cc.value} 저작자표시-동일조건변경허락 4.0 국제`,
	},
	"cc-by-sa-3.0": {
		label: `${verbatimTerms.cc.value} 저작자표시-동일조건변경허락 3.0 이식되지 않음`,
	},
	"all-rights-reserved": { label: "판권 소유" },
	"cc-by-nc-4.0": {
		label: `${verbatimTerms.cc.value} 저작자표시-비영리 4.0 국제`,
	},
	"cc-by-4.0": {
		label: `${verbatimTerms.cc.value} 저작자표시 4.0 국제`,
	},
	"cc0-1.0": { label: `${verbatimTerms.cc.value} 0 1.0 범용` },
	"rezics-unit-content-license-v1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1.value,
	},
} satisfies Readonly<Record<LicenseId, LicenseOptionTranslation>>;

export default {
	unspecified: "명시되지 않음",
	exclusiveSelectionHint: `판권 소유를 새로 선택하면 이번에 새로 고른 다른 공개 ${koTerminology.license.forms.label}는 일단 해제됩니다. 이미 저장된 조합은 그대로 유지됩니다.`,
	residualRightsNotice: `판권 소유는 함께 나열된 다른 ${koTerminology.license.forms.label}가 명시적으로 부여하지 않은 나머지 권리에만 적용됩니다. 그 ${koTerminology.license.forms.label}를 덮거나 취소하지 않습니다.`,
	viewTerms: `${licenseTerms.inline} 약관 보기`,
	options,
	affirmativeAcknowledgement: {
		confirmationLabel: `${verbatimTerms.rezicsUnitContentLicenseV1.value}을(를) 읽고 동의했으며, 이 콘텐츠에 이 ${koTerminology.license.forms.label}를 부여할 권한이 있음을 확인합니다.`,
		profileOwnedOnlyNotice: `공공 작품은 ${verbatimTerms.rezics.value}에 콘텐츠 ${koTerminology.license.forms.label}를 부여하지 않으며 작품 색인 정보만 수록하는 데 사용해야 합니다.`,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
