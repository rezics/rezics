import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	title: `${verbatimTerms.rezics.value} — 콘텐츠의 정체성, 구조, 이력`,
	description: `${verbatimTerms.rezics.value} 제품과 공유 플랫폼 기능을 살펴보세요.`,
} satisfies typeof import("../../en/home/meta").default;

export default content;
