import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	title: `${verbatimTerms.rezics.value} 제품 & 플랫폼`,
	description: `${verbatimTerms.rezics.value}의 모든 제품과 공유 기능을 살펴보세요.`,
} satisfies typeof import("../../../en/products/directory/meta").default;

export default content;
