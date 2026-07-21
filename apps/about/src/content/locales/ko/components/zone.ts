import { koTerminology } from "@rezics/i18n/terminology/ko";

const content = {
	zone: koTerminology.zone.forms.label,
	blocks: "블록 설정",
	query: "콘텐츠 쿼리",
	history: "History",
	preview: "제품 미리보기",
	path: `${koTerminology.zone.forms.label} / 설정`,
	blockSchema: "블록 스키마",
	headerBlock: "헤더 블록",
	feedBlock: "Feed 블록 · query: recent",
	collectionBlock: "Collection 블록 · 참조",
	feedResult: "Feed 결과",
	postCard: `${koTerminology.post.forms.label} 카드`,
	catalogResult: "Catalog 결과",
	bookCard: "Book 카드",
	discussion: "토론",
	comment: "Comment",
} satisfies typeof import("../../en/components/zone").default;

export default content;
