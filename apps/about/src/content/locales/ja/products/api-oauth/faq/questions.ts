import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	preview: `${verbatimTerms.api.value} & ${verbatimTerms.oauth.value} の画面は実際のスクリーンショットですか？`,
	status: "実装状態はどのように決まりますか？",
} satisfies typeof import("../../../../en/products/api-oauth/faq/questions").default;

export default content;
