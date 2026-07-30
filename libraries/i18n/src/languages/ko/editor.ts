import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: realmTerms } = koTerminology.realm;
const { forms: zoneTerms } = koTerminology.zone;
const { forms: entityTerms } = koTerminology.entity;

export default {
	loading: "편집기 로딩 중…",
	loadFailed: "편집기를 로드할 수 없습니다.",
	paragraph: "단락",
	heading2: "헤딩 2",
	heading3: "헤딩 3",
	quote: "인용",
	bold: "굵게",
	italic: "기울임",
	bulletList: "글머리 기호 목록",
	numberedList: "번호 매기기 목록",
	link: "링크",
	linkPrompt: `${verbatimTerms.http.value}, ${verbatimTerms.https.value}, ${verbatimTerms.mailto.value} 또는 상대 ${verbatimTerms.url.value}를 사용하세요.`,
	linkUrl: verbatimTerms.url.value,
	openInNewTab: "새 탭에서 열기",
	addLink: "링크 추가",
	removeLink: "링크 제거",
	invalidLink: `지원되는 ${verbatimTerms.url.value}를 입력하세요.`,
	undo: "실행 취소",
	redo: "다시 실행",
	style: "텍스트 스타일",
	preview: "미리보기",
	placeholder: "글을 쓰거나 블록을 위해 /를 입력하세요.",
	slashMenu: "삽입",
	slashHint: `블록에는 /를 사용하고 유닛 언급에는 ${verbatimTerms.profileSlugPrefix.value}, t/, e/, r/, z/를 사용하세요.`,
	mentionSearchPrompt: "검색하려면 입력하세요.",
	mentionUsers: "사용자",
	mentionTags: "태그",
	mentionEntities: entityTerms.label,
	mentionRealms: realmTerms.pluralLabel,
	mentionZones: zoneTerms.pluralLabel,
	unavailableMention: "사용할 수 없는 유닛",
	richText: "리치 텍스트",
	toolbar: "서식 도구 모음",
} satisfies typeof import("../zh-Hant/editor").default;
