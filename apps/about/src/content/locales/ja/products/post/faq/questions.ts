import { jaTerminology } from "@rezics/i18n/terminology/ja";

const content = {
	preview: `${jaTerminology.post.forms.inline}の画面は実際のスクリーンショットですか？`,
	status: "実装状態はどのように決まりますか？",
} satisfies typeof import("../../../../en/products/post/faq/questions").default;

export default content;
