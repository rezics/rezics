import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: entityTerms } = koTerminology.entity;

export default {
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
	centimetreUnit: "cm",
	kilogramUnit: "kg",
	newEntity: `새 ${entityTerms.label}`,
	newTag: "새 태그",
	externalLinksDescription: `이 ${entityTerms.inline}에 관한 정보를 뒷받침하는 공개 페이지입니다.`,
	externalLinksEmpty: "아직 외부 링크가 없습니다.",
	relatedContentTitle: "관련 콘텐츠",
	relatedContentDescription: `이 ${entityTerms.inline}와 관련된 콘텐츠입니다.`,
	relatedContentEmptyTitle: "관련 콘텐츠 없음",
	relatedContentEmptyDescription: "아직 표시할 관련 콘텐츠가 없습니다.",
} satisfies typeof import("../zh-Hant/entities").default;
