import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}、${verbatimTerms.png.value}、${verbatimTerms.webp.value}、または ${verbatimTerms.avif.value}`;

export default {
	title: "カバー",
	choose: "画像を選択、削除、または貼り付け",
	hint: `${SupportedImageFormats}、最大 10 ${verbatimTerms.mib.value}`,
	upload: "表紙をアップロード",
	replace: "置き換え",
	remove: "削除",
	cancel: "キャンセル",
	inherit: "ローカリゼーション順で使用可能な最初の表紙を使用",
	invalid: `10 ${verbatimTerms.mib.value} 未満の ${SupportedImageFormats} 画像を選択してください。`,
	failed: "表紙をアップロードできませんでした。再試行してください。",
} satisfies typeof import("../zh-Hant/cover").default;
