import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	preview: `${verbatimTerms.api.value} & ${verbatimTerms.oauth.value} 화면은 실제 제품 스크린샷인가요?`,
	status: "구현 상태는 어떻게 결정하나요?",
} satisfies typeof import("../../../../en/products/api-oauth/faq/questions").default;

export default content;
