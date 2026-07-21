import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	title: `${verbatimTerms.rezics.value} — 讓內容保持身分、結構與歷史`,
	description: `探索 ${verbatimTerms.rezics.value} 的產品、共享能力與開放平台。`,
} satisfies typeof import("../../en/home/meta").default;

export default content;
