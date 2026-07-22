import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { insert } from "native-i18n";

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
	avatarPicker: {
		typeLabel: "頭像類型",
		tabs: { icon: "圖示", emoji: "表情符號", image: "圖片" },
		preview: "頭像預覽",
		inherited: "繼承的頭像",
		icon: {
			search: "搜尋圖示",
			searchHint: "輸入至少兩個字元來搜尋圖示",
			style: "圖示樣式",
			styles: { fas: "實心", fab: "品牌" },
			loading: "正在搜尋圖示……",
			empty: "找不到相符的圖示。",
			failed: "目前無法搜尋圖示，請稍後再試。",
			select: insert("選擇圖示：{{name}}", { name: String }),
			unconfigured: `${verbatimTerms.fontAwesome.value} ${verbatimTerms.cdn.value} 尚未設定，因此無法顯示圖示預覽。`,
		},
		emoji: {
			search: "搜尋表情符號",
			loading: "正在載入表情符號……",
			empty: "找不到相符的表情符號。",
		},
	},
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
