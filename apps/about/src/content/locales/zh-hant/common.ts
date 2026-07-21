import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	siteName: verbatimTerms.rezics.value,
	nav: {
		products: "產品",
		platform: "平台",
		history: "歷史",
		docs: "文件",
		github: verbatimTerms.github.value,
		language: "語言",
		theme: "主題",
		openMenu: "開啟選單",
		closeMenu: "關閉選單",
	},
	theme: {
		light: "淺色",
		dark: "深色",
		toggle: "切換明暗主題",
	},
	status: {
		implemented: "已實作",
		documented: "已確認設計",
		planned: "規劃中",
		research: "研究中",
	},
	classes: {
		surface: "載體產品",
		capability: "共享能力",
		manifestation: "產品形態",
		protocol: "內部協議",
	},
	labels: {
		conceptPreview: "概念預覽",
		conceptCaption: "以程式碼重建的可替換產品展示區，後續可直接換成相同尺寸的真實截圖。",
		viewProduct: "查看產品",
		viewAll: "查看全部",
		learnMore: "深入了解",
		documentation: `${verbatimTerms.outline.value} 文件`,
		sourceCode: "原始碼",
		relatedProducts: "相關產品",
		usedCapabilities: "使用的共享能力",
		noParent: "獨立產品，沒有載體父產品",
		parentProduct: "父產品",
		sourceBasis: "事實來源",
	},
	footer: {
		statement: `${verbatimTerms.rezics.value} 是一套以內容身分、結構與歷史為核心的開放產品系統。`,
		productLinks: "產品",
		platformLinks: "平台",
		openLinks: "開放",
		implementation: `${verbatimTerms.agpl30.value} · 使用 ${verbatimTerms.vike.value} 與 ${verbatimTerms.react.value} 建置的靜態網站`,
	},
	notFound: {
		title: "找不到這個頁面",
		body: "此連結可能已移動，或尚未成為公開產品頁。",
		back: "回到首頁",
	},
	a11y: {
		home: `${verbatimTerms.rezics.value} 首頁`,
		skipContent: "跳到主要內容",
		primaryNavigation: "主要導覽",
		mobileNavigation: "行動版導覽",
		breadcrumb: "麵包屑",
		modes: "能力模式",
	},
} satisfies typeof import("../en/common").default;

export default content;
