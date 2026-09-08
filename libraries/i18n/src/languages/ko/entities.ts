import { koTerminology } from "@rezics/i18n/terminology/ko";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: entityTerms } = koTerminology.entity;

export default {
	contextMeasurements: {
		title: "내용별 신체 측정값",
		context: "관련 내용",
		chooseContext: "관련 내용 선택",
		noVisibleMeasurement: "이 맥락에서 현재 볼 수 있는 측정값이 없습니다.",
		edit: "이 맥락의 측정값 편집",
		millimetres: "밀리미터",
		grams: "그램",
		scopeNotice:
			"이 값은 선택한 내용에만 적용됩니다. 저장하면 해당 맥락의 측정값 전체를 대체합니다.",
		unknownNotice: "알 수 없는 값은 비워 두세요. 0은 0으로 저장됩니다.",
		invalid: "지원 범위 내의 음이 아닌 정수를 입력하거나 알 수 없는 값은 비워 두세요.",
		save: "이 맥락의 측정값 저장",
	},
	entities: entityTerms.pluralLabel,
	tags: "태그",
	kind: "종류",
	verification: "검증",
	owner: "소유자",
	verified: "검증됨",
	unverified: "검증되지 않음",
	measurements: "신체 치수",
	height: "키",
	weight: "몸무게",
	bust: "가슴둘레",
	waist: "허리둘레",
	hips: "엉덩이둘레",
	centimetreUnit: verbatimTerms.centimetreUnitSymbol.value,
	kilogramUnit: verbatimTerms.kilogramUnitSymbol.value,
	newEntity: `새 ${entityTerms.label}`,
	newTag: "새 태그",
	externalLinksDescription: `이 ${entityTerms.inline}에 관한 정보를 뒷받침하는 공개 페이지입니다.`,
	externalLinksEmpty: "아직 외부 링크가 없습니다.",
	relatedContentTitle: "관련 콘텐츠",
	relatedContentDescription: `이 ${entityTerms.inline}와 관련된 콘텐츠입니다.`,
	relatedContentEmptyTitle: "관련 콘텐츠 없음",
	relatedContentEmptyDescription: "아직 표시할 관련 콘텐츠가 없습니다.",
} satisfies typeof import("../zh-Hant/entities").default;
