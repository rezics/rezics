import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	title: `${verbatimTerms.rezics.value} 产品与平台`,
	description: `浏览 ${verbatimTerms.rezics.value} 的所有产品、产品形态与共享能力。`,
} satisfies typeof import("../../../en/products/directory/meta").default;

export default content;
