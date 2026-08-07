import { jaTerminology } from "@rezics/i18n/terminology/ja";

const { forms: entityTerms } = jaTerminology.entity;

export default {
	entities: entityTerms.pluralLabel,
	tags: "タグ",
	kind: "種類",
	verification: "確認",
	owner: "所有者",
	verified: "認証済み",
	unverified: "未認証",
	newEntity: `新しい${entityTerms.label}`,
	newTag: "新しいタグ",
	sourceLinksDescription: `${entityTerms.inline}に関する情報の根拠となる公開ページです。`,
	sourceLinksEmpty: "出典リンクはまだありません。",
	relatedContentTitle: "関連コンテンツ",
	relatedContentDescription: `${entityTerms.inline}に関連するコンテンツです。`,
	relatedContentEmptyTitle: "関連コンテンツはありません",
	relatedContentEmptyDescription: "表示できる関連コンテンツはまだありません。",
} satisfies typeof import("../zh-Hant/entities").default;
