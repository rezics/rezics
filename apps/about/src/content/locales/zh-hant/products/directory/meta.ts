import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	title: `${verbatimTerms.rezics.value} 產品與平台`,
	description: `瀏覽 ${verbatimTerms.rezics.value} 的所有產品、產品形態與共享能力。`,
} satisfies typeof import("../../../en/products/directory/meta").default;

export default content;
