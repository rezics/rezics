import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}、${verbatimTerms.png.value}、${verbatimTerms.webp.value} 或 ${verbatimTerms.avif.value}`;

export default {
	choose: "選擇、拖入或貼上圖片",
	hint: `${SupportedImageFormats}，最大 10 ${verbatimTerms.mib.value}`,
	replace: "取代",
	remove: "移除",
	cancel: "取消",
	invalid: `請選擇不超過 10 ${verbatimTerms.mib.value} 的 ${SupportedImageFormats} 圖片。`,
	current: "目前語言的覆蓋圖片",
	displayPreview: "實際顯示範圍",
	bannerPreview: {
		description: "圖片會完整保存；框外區域不會顯示。建議使用 4:1 圖片。",
		showOriginal: "查看完整圖片",
		hideOriginal: "隱藏完整圖片",
		original: "完整圖片",
	},
	roles: {
		avatar: {
			title: "頭像",
			inherit: "依照在地化順序使用第一個可用頭像",
			failed: "頭像上傳失敗，請重試。",
		},
		banner: {
			title: "橫幅",
			inherit: "依照在地化順序使用第一個可用橫幅",
			failed: "橫幅上傳失敗，請重試。",
		},
		cover: {
			title: "封面",
			inherit: "依照在地化順序使用第一個可用封面",
			failed: "封面上傳失敗，請重試。",
		},
	},
};
