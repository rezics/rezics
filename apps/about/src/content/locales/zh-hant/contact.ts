import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	meta: {
		title: `聯絡 ${verbatimTerms.rezics.value}`,
		description: `聯絡 ${verbatimTerms.rezics.value} 專案維護者，討論參與開發與合作事宜。`,
	},
	eyebrow: "聯絡我們",
	title: "一起打造開放的內容基礎設施",
	introduction: "若您想參與開發、回報問題或討論合作，歡迎透過以下方式聯絡我們。",
	role: "專案維護者",
	emailLabel: "電子郵件",
	githubLabel: verbatimTerms.github.value,
} satisfies typeof import("../en/contact").default;
