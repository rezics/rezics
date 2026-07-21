import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	title: `${verbatimTerms.rezics.value} プロダクト＆プラットフォーム`,
	description: `${verbatimTerms.rezics.value} の全プロダクトと共有機能を一覧できます。`,
} satisfies typeof import("../../../en/products/directory/meta").default;

export default content;
