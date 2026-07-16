const content = {
	nav: {
		products: "產品",
		platform: "平台",
		history: "History",
		docs: "文件",
		github: "GitHub",
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
		conceptCaption: "以程式碼重建的可替換產品展位，後續可直接替換為同尺寸真實截圖。",
		viewProduct: "查看產品",
		viewAll: "查看全部",
		learnMore: "深入了解",
		documentation: "Outline 文件",
		sourceCode: "原始碼",
		relatedProducts: "相關產品",
		usedCapabilities: "使用的共享能力",
		noParent: "獨立產品，沒有載體父產品",
		parentProduct: "父產品",
		sourceBasis: "事實來源",
	},
	footer: {
		statement: "Rezics 是一套以內容身份、結構與歷史為核心的開放產品系統。",
		productLinks: "產品",
		platformLinks: "平台",
		openLinks: "開放",
	},
	notFound: {
		title: "找不到這個頁面",
		body: "此連結可能已移動，或尚未成為公開產品頁。",
		back: "回到首頁",
	},
	a11y: {
		skipContent: "跳到主要內容",
		primaryNavigation: "主要導覽",
		mobileNavigation: "行動版導覽",
		breadcrumb: "麵包屑",
		modes: "能力模式",
	},
} satisfies typeof import("../en/common").default;

export default content;
