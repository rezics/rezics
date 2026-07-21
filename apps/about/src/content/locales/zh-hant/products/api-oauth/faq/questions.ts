import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	preview: `${verbatimTerms.api.value} & ${verbatimTerms.oauth.value} 的畫面是真實產品截圖嗎？`,
	status: "頁面上的實作狀態如何判定？",
} satisfies typeof import("../../../../en/products/api-oauth/faq/questions").default;

export default content;
