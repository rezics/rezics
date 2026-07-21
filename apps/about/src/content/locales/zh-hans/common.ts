import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	siteName: verbatimTerms.rezics.value,
	nav: {
		products: "产品",
		platform: "平台",
		history: "History",
		docs: "文档",
		github: verbatimTerms.github.value,
		language: "语言",
		theme: "主题",
		openMenu: "打开菜单",
		closeMenu: "关闭菜单",
	},
	theme: {
		light: "浅色",
		dark: "深色",
		toggle: "切换明暗主题",
	},
	status: {
		implemented: "已实现",
		documented: "已确认设计",
		planned: "规划中",
		research: "研究中",
	},
	classes: {
		surface: "载体产品",
		capability: "共享能力",
		manifestation: "产品形态",
		protocol: "内部协议",
	},
	labels: {
		conceptPreview: "概念预览",
		conceptCaption: "用代码重建的可替换产品展位，之后可直接替换为同尺寸真实截图。",
		viewProduct: "查看产品",
		viewAll: "查看全部",
		learnMore: "深入了解",
		documentation: `${verbatimTerms.outline.value} 文档`,
		sourceCode: "源代码",
		relatedProducts: "相关产品",
		usedCapabilities: "使用的共享能力",
		noParent: "独立产品，没有载体父产品",
		parentProduct: "父产品",
		sourceBasis: "事实来源",
	},
	footer: {
		statement: `${verbatimTerms.rezics.value} 是一套以内容身份、结构与历史为核心的开放产品系统。`,
		productLinks: "产品",
		platformLinks: "平台",
		openLinks: "开放",
		implementation: `${verbatimTerms.agpl30.value} · 使用 ${verbatimTerms.vike.value} 与 ${verbatimTerms.react.value} 构建的静态网站`,
	},
	notFound: {
		title: "找不到这个页面",
		body: "链接可能已移动，或尚未成为公开产品页。",
		back: "返回首页",
	},
	a11y: {
		home: `${verbatimTerms.rezics.value} 首页`,
		skipContent: "跳到主要内容",
		primaryNavigation: "主要导航",
		mobileNavigation: "移动端导航",
		breadcrumb: "面包屑",
		modes: "能力模式",
	},
} satisfies typeof import("../en/common").default;

export default content;
