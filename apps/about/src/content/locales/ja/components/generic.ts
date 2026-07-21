import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	record: "レコード",
	relations: "関係",
	history: "History",
	conceptPreview: "コンセプトプレビュー",
	description:
		"中立的で置き換え可能なプロダクト画面です。装飾目的のアートワークや架空の利用指標は含みません。",
	identity: "同一性",
	stableRecord: "安定したレコード",
	unit: "Unit",
	relatedProducts: "関連プロダクト",
	references: "参照",
	publishedState: "公開状態",
	sharedCapabilities: "共有機能",
	attribution: "Attribution",
	entity: "Entity",
	tags: "Tags",
	queryable: "クエリ可能",
	api: verbatimTerms.api.value,
	permissioned: "権限制御",
} satisfies typeof import("../../en/components/generic").default;

export default content;
