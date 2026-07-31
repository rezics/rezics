import type { PublicationLicenseId, UnitContentLicenseSlug } from "@rezics/license";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { koTerminology } from "@rezics/i18n/terminology/ko";

type LicenseOptionTranslation = { readonly label: string };
const { forms: publicationLicenseTerms } = koTerminology.publicationLicense;

const options = {
	"cc-by-nc-sa-4.0": {
		label: `${verbatimTerms.cc.value} 저작자표시-비영리-동일조건변경허락 4.0 국제`,
	},
	"cc-by-sa-4.0": {
		label: `${verbatimTerms.cc.value} 저작자표시-동일조건변경허락 4.0 국제`,
	},
	"all-rights-reserved": { label: "판권 소유" },
	"cc-by-nc-4.0": {
		label: `${verbatimTerms.cc.value} 저작자표시-비영리 4.0 국제`,
	},
	"cc-by-4.0": {
		label: `${verbatimTerms.cc.value} 저작자표시 4.0 국제`,
	},
	"cc0-1.0": { label: `${verbatimTerms.cc.value} 0 1.0 범용` },
} satisfies Readonly<Record<PublicationLicenseId, LicenseOptionTranslation>>;

const unitContentOptions = {
	"rezics-unit-content-license-v1": {
		label: verbatimTerms.rezicsUnitContentLicenseV1.value,
	},
} satisfies Readonly<Record<UnitContentLicenseSlug, LicenseOptionTranslation>>;

export default {
	unspecified: "명시되지 않음",
	viewTerms: `${publicationLicenseTerms.inline} 약관 보기`,
	options,
	unitContent: {
		none: "없음",
		viewTerms: `${verbatimTerms.rezicsUnitContentLicenseV1.value} 보기`,
		grantNotice:
			"한 번 부여하면 철회할 수 없으며, 이 콘텐츠에 대한 이후 기여와 소유권 이전에도 계속 적용됩니다.",
		noneNotice:
			"콘텐츠 라이선스가 부여되지 않습니다. 이 작품을 색인 항목으로만 사용하고 작품 콘텐츠를 게시하거나 호스팅하지 않을 때만 ‘없음’을 선택하세요.",
		noneConfirmationTitle: `${verbatimTerms.rezics.value} 콘텐츠 라이선스 없이 만드시겠습니까?`,
		noneConfirmationNotice: `${verbatimTerms.rezics.value}에서 작품 콘텐츠를 게시하거나 호스팅하려면 콘텐츠 라이선스를 유지하세요. 이 항목이 작품 색인에만 사용된다면 콘텐츠 라이선스가 필요하지 않습니다. 라이선스 없이 작품 본문이나 기타 저작권 보호 콘텐츠를 이 항목에 게시하지 마세요.`,
		keepLicense: "라이선스 유지",
		confirmNone: "라이선스 없음으로 변경",
		publicWorkNotice: `공공 작품은 ${verbatimTerms.rezics.value}에 콘텐츠 라이선스를 부여하지 않으며 작품 색인 정보만 수록하는 데 사용해야 합니다.`,
		grantedNotice: "이 콘텐츠에는 이 콘텐츠 라이선스가 영구적으로 적용됩니다.",
		contributionNotice: `이 라이선스가 적용되는 동안 제공하는 콘텐츠는 동일한 조건으로 ${verbatimTerms.rezics.value}에 라이선스됩니다. 별도로 라이선스를 선택할 필요가 없습니다.`,
		cancelGrant: "취소",
		confirmGrant: "라이선스 부여",
		options: unitContentOptions,
	},
} satisfies typeof import("../zh-Hant/licenses").default;
