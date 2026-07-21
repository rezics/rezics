import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	title: `${verbatimTerms.rezics.value} — コンテンツの同一性・構造・履歴`,
	description: `${verbatimTerms.rezics.value} のプロダクトと共有機能を紹介します。`,
} satisfies typeof import("../../en/home/meta").default;

export default content;
