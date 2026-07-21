import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	preview: `${verbatimTerms.api.value} & ${verbatimTerms.oauth.value} 的画面是真实产品截图吗？`,
	status: "页面上的实现状态如何判定？",
} satisfies typeof import("../../../../en/products/api-oauth/faq/questions").default;

export default content;
