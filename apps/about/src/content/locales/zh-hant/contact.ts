import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { ContactCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const GITHUB = verbatimTerms.github.value;
const MAINTAINER = verbatimTerms.edgeCoordinates.value;
const MAINTAINER_EMAIL = verbatimTerms.edgeCoordinatesEmail.value;

export const zhHantContactCopy = {
	meta: {
		title: `聯繫我們 — ${BRAND}`,
		description: `與 ${BRAND} 專案維護者討論產品合作、開源參與、內容模型與其他建議。`,
	},
	hero: {
		title: "聯繫我們",
		description:
			"無論你想帶來一種新的故事形式、參與開源建設，或只是發現某件值得被做得更好的事，我們都願意聽你說。",
	},
	topicsTitle: "我們可以從這些事情開始",
	topics: [
		{
			title: "產品與內容合作",
			body: `討論如何讓出版社、創作者、社群或內容工具連接 ${BRAND} 的作品、結構與歷史能力。`,
		},
		{
			title: "參與開源建設",
			body: "一起改善程式、文件、設計、研究與社群，讓開放的內容基礎設施真正能被使用。",
		},
		{
			title: "問題與建議",
			body: "回報問題，或告訴我們哪些產品邊界、資料關係與使用流程仍然不夠清楚。",
		},
	],
	maintainer: {
		title: "直接聯繫專案維護者",
		description: "來信請簡單說明你的背景、想討論的事情，以及希望我們如何回覆。",
		name: MAINTAINER,
		role: "專案維護者",
		emailLabel: "電子郵件",
		email: MAINTAINER_EMAIL,
		githubLabel: GITHUB,
		sendEmail: "寄送電子郵件",
	},
} satisfies ContactCopy;
