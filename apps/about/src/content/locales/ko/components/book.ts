import { koTerminology } from "@rezics/i18n/terminology/ko";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	sectionsLabel: "Book 섹션",
	book: "도서",
	main: "기본 판본",
	identity: "책 정체성",
	variants: "main과 variants",
	contents: "장 구조",
	history: "History",
	published: "공개됨",
	title: "Book 제목",
	variantDescription: "main · variant: translation-edition · Unit / Book",
	contentStructure: verbatimTerms.contentStructure.value,
	gameContentStructure: verbatimTerms.gameContentStructure.value,
	chapterOne: "01 · 장 제목",
	chapterTwo: "02 · 장 제목",
	reusedInterlude: "03 · 재사용된 막간",
	postA: `${koTerminology.post.forms.label} A`,
	postB: `${koTerminology.post.forms.label} B`,
	credits: "귀속 관계",
	creditAttribution: verbatimTerms.creditAttribution.value,
	author: "저자",
	translator: "번역자",
	publisher: "출판사",
	entity: "Entity 레코드",
} satisfies typeof import("../../en/components/book").default;

export default content;
