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
} satisfies typeof import("../zh-Hant/entities").default;
