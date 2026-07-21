import { jaTerminology } from "@rezics/i18n/terminology/ja";

const content = {
	zone: jaTerminology.zone.forms.label,
	blocks: "ブロック設定",
	query: "コンテンツクエリ",
	history: "History",
	preview: "プロダクトプレビュー",
	path: `${jaTerminology.zone.forms.label} / 設定`,
	blockSchema: "ブロックスキーマ",
	headerBlock: "ヘッダーブロック",
	feedBlock: "Feed ブロック · query: recent",
	collectionBlock: "Collection ブロック · 参照",
	feedResult: "Feed の結果",
	postCard: `${jaTerminology.post.forms.label}カード`,
	catalogResult: "Catalog の結果",
	bookCard: "Book カード",
	discussion: "ディスカッション",
	comment: "Comment",
} satisfies typeof import("../../en/components/zone").default;

export default content;
