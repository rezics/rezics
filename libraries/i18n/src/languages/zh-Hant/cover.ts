import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}、${verbatimTerms.png.value}、${verbatimTerms.webp.value} 或 ${verbatimTerms.avif.value}`;

export default {
	title: "封面",
	choose: "選擇、拖入或貼上圖片",
	hint: `${SupportedImageFormats}，最大 10 ${verbatimTerms.mib.value}`,
	upload: "上傳封面",
	replace: "取代",
	remove: "移除",
	cancel: "取消",
	inherit: "依照在地化順序使用第一個可用封面",
	invalid: `請選擇不超過 10 ${verbatimTerms.mib.value} 的 ${SupportedImageFormats} 圖片。`,
	failed: "封面上傳失敗，請重試。",
};
