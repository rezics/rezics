import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { SiteCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const API = verbatimTerms.api.value;
const OAUTH = verbatimTerms.oauth.value;
const GITHUB = verbatimTerms.github.value;
const REZICS_INC = verbatimTerms.rezicsInc.value;
const AGPL30 = verbatimTerms.agpl30.value;

export const zhHansContent = {
	nav: {
		home: "首页",
		how: "运作原理",
		uses: "用途",
		products: "能力参考",
		enter: `进入 ${BRAND}`,
		language: "语言",
		theme: "显示模式",
		openMenu: "打开菜单",
		closeMenu: "关闭菜单",
	},
	theme: { light: "浅色", dark: "深色", toggle: "切换显示模式" },
	a11y: {
		skipContent: "跳到主要内容",
		primaryNavigation: "主要导航",
		utilityNavigation: "实用工具",
		home: `${BRAND} 首页`,
	},
	meta: {
		home: {
			title: `${BRAND} — 与所爱的故事相遇`,
			description: "用统一作品身份连接版本、内容、社区与跨语言知识。",
		},
		how: {
			title: `运作原理 — ${BRAND}`,
			description: `从作品身份开始，理解 ${BRAND} 如何连接内容、历史与社区。`,
		},
		uses: {
			title: `用途 — ${BRAND}`,
			description: "探索读者、社区、创作者与开发者如何使用同一套作品网络。",
		},
		products: {
			title: `能力参考 — ${BRAND}`,
			description: `完整浏览 ${BRAND} 的作品、内容、社区与开放能力。`,
		},
	},
	home: {
		eyebrow: "继承 · 创作 · 传播",
		title: "与所爱的故事相遇。",
		lead: `${BRAND} 是一个原生支持多语言的内容组织、发布与社区协作平台。它让作品、${zhHansTerminology.metadata.forms.inline}、${zhHansTerminology.post.forms.plural}、收藏、分类和社区空间拥有各自稳定的身份，并能在同一套系统中被连接、创作、管理、探索、讨论与治理。`,
		explore: "探索用途",
		understand: "理解运作原理",
		problem: {
			title: "我们爱的是同一部作品，找到的却常是碎片。",
			body: "不同语言名称、版本、媒体形态和社区平台各自建立条目。读者需要反复辨认，创作者归属容易丢失，社区积累的知识也难以延续。",
		},
		promise: {
			title: "先辨认作品，再让知识生长。",
			body: `${BRAND} 以稳定作品身份作为共同起点。名称可以翻译，内容可以演进，社区可以从不同角度组织，但它们仍指向同一个可理解、可追溯的对象。`,
		},
		principles: [
			{ title: "继承", body: "作品已经拥有的历史、语言、版本与社区记忆。" },
			{ title: "创作", body: "让人们撰写内容、建立结构、补充归属并形成新的理解。" },
			{ title: "传播", body: "通过社区、开放协议与跨语言连接，让知识继续流动。" },
		],
		model: {
			title: "一个身份，逐层形成完整语境。",
			body: "底层模型把不该混淆的概念分开，再让它们通过明确关系合作。",
			steps: [
				{ title: "作品身份", body: "作品拥有不随语言与界面改变的稳定核心。" },
				{
					title: "版本与关系",
					body: `发行、系列、${zhHansTerminology.entity.forms.label}、标签和归属把作品放回真实上下文。`,
				},
				{ title: "内容与历史", body: "内容结构、编辑与历史保留顺序、变更与可复用性。" },
				{
					title: "个人与社区",
					body: `收藏、${zhHansTerminology.realm.forms.label}、${zhHansTerminology.zone.forms.label}和动态把模型变成日常体验。`,
				},
			],
		},
		outcomes: {
			title: "为读者，也为作品本身。",
			body: "同一套基础同时降低寻找成本、保留创作归属，让作品遇上适合的读者。",
			cards: [
				{ title: "找到", body: "跨语言辨认作品、版本与相关创作者，不再从零拼凑。" },
				{ title: "理解", body: "沿着结构、评论、维基、历史和关系看见作品的完整上下文。" },
				{
					title: "延续",
					body: "收藏进度、加入社区、补充知识，让个人体验成为共同记忆的一部分。",
				},
			],
		},
		open: {
			title: "开放不是附加功能，而是记忆得以延续的条件。",
			body: `${BRAND} 用开放源代码、可携内容、${zhHansTerminology.publicationLicense.forms.label}和权限化 ${API} 连接外部工具。社区不必把共同知识锁在单一界面里。`,
		},
		closing: {
			title: "从一部你在意的作品开始。",
			body: `进入主站，探索作品、${zhHansTerminology.realm.forms.label}与正在形成的共同知识。`,
			action: `进入 ${BRAND}`,
		},
		contact: {
			title: "有想法想和我们一起实现吗？",
			body: "无论是产品合作、参与开源、内容模型，还是任何值得做得更好的建议，都欢迎与我们聊聊。",
			action: "联系我们",
		},
	},
	how: {
		eyebrow: "从底层开始",
		title: "不是更大的目录，而是一套让作品保持连接的方法。",
		lead: `${BRAND} 从身份、呈现、关系、内容、信任到探索逐层建立。每一层只承担自己的意义，因此能够在语言、媒体和社区之间延伸。`,
		stages: [
			{
				title: "1. 作品身份",
				body: `稳定 ${verbatimTerms.id.value} 辨认作品本身；本地化名称与类型${zhHansTerminology.metadata.forms.label}可以演进，却不会制造另一部作品。`,
			},
			{
				title: "2. 呈现与类型",
				body: "书籍、媒体、软件等类型保留各自需要的字段与体验，同时共享身份与关系层。",
			},
			{
				title: "3. 关系与归属",
				body: `系列、发行、${zhHansTerminology.entity.forms.label}、标签、创作归属与主题关联，把作品放进可以理解的网络。`,
			},
			{
				title: "4. 内容区块与内容结构",
				body: "内容区块表达可呈现内容；内容结构管理出现位置、顺序、复用与分支，两者不会互相冒充。",
			},
			{
				title: "5. 历史、许可与治理",
				body: `发布边界形成可追溯版本；${zhHansTerminology.publicationLicense.forms.label}、访问规则和社区治理说明谁能做什么，以及知识如何被信任。`,
			},
			{
				title: "6. 探索表面",
				body: `搜索、动态、${zhHansTerminology.realm.forms.label}和${zhHansTerminology.zone.forms.label}把底层网络变成寻找、阅读、参与和返回的日常路径。`,
			},
		],
		integrity: {
			title: "分开保存意义，连接起来形成价值。",
			body: "身份不是名称，发行不是系列，内容区块不是目录节点，社区空间也不拥有它所引用的作品。清楚边界让每一条连接都能被解释。",
		},
	},
	uses: {
		eyebrow: "从需要出发",
		title: "一套作品网络，多条真实旅程。",
		lead: "读者不需要先理解数据模型。他们从寻找一本书、追踪一个系列、加入社区或保存阅读进度开始；底层连接会在需要时自然出现。",
		resultLabel: "得到",
		journeys: [
			{
				title: "跨语言找到同一部作品",
				body: "从熟悉的译名、原名、作者、版本或媒体形态进入，逐步辨认它们的关系。",
				result: "少一次重复搜索，多一个可信入口。",
			},
			{
				title: "理解版本与创作上下文",
				body: `查看系列、发行、${zhHansTerminology.entity.forms.label}、角色、创作者与出版关系，不把所有差异压成平面记录。`,
				result: "知道自己正在看什么，以及它从哪里来。",
			},
			{
				title: "阅读并贡献内容",
				body: `沿书籍结构阅读，查看${zhHansTerminology.post.forms.label}、维基、图片、评论与评分，也能补充自己的理解。`,
				result: "内容与作品身份保持连接。",
			},
			{
				title: "加入共同兴趣的社区",
				body: `在${zhHansTerminology.realm.forms.label}里形成共同规则，在${zhHansTerminology.zone.forms.label}里策展特定视角，通过动态延续讨论。`,
				result: "社区知识不再只是快速流逝的信息。",
			},
			{
				title: "收藏、返回与继续",
				body: "用收藏和书库整理作品，用进度保存阅读位置，下次返回仍能接上原有上下文。",
				result: "个人旅程与共同知识相互支持。",
			},
			{
				title: "出版、归属与许可",
				body: `创作者和组织建立内容结构、标记贡献关系、选择${zhHansTerminology.publicationLicense.forms.label}并保留发布历史。`,
				result: "作品能够被理解和引用，也能保留应有归属。",
			},
			{
				title: "建立工具与新入口",
				body: `开发者通过 ${API}、${OAUTH} 与令牌取得明确范围，把搜索、编辑或社区工作流接入同一套身份。`,
				result: "集成扩展网络，而不是制造新的数据孤岛。",
			},
		],
		closing: {
			title: "想看每项能力如何配合？",
			body: "能力参考从作品身份一路列到开放接口，并说明各自的价值、流程、关系与边界。",
			action: "浏览完整能力",
		},
	},
	products: {
		eyebrow: "完整参考",
		title: "从作品身份到开放生态。",
		lead: "26 项能力按照它们在整体模型中的位置排列。这不是互不相关的功能清单，而是一条从辨认作品到延续共同知识的路径。",
		searchLabel: "搜索能力",
		searchPlaceholder: "输入名称或用途",
		allLayers: "全部",
		empty: "没有符合条件的能力。",
		openProduct: "查看能力",
		layers: {
			identity: {
				title: "身份与关系",
				body: `辨认作品，连接版本、系列、${zhHansTerminology.entity.forms.label}与分类。`,
			},
			form: { title: "内容形态", body: "承载阅读、观看、创作、评论与回应。" },
			structure: { title: "结构与记忆", body: "组合内容，保留发布、差异与演进上下文。" },
			community: { title: "个人与社区", body: "收藏、策展、讨论、追踪并返回。" },
			open: { title: "开放生态", body: "用清楚权限连接工具、服务与新的入口。" },
		},
	},
	product: {
		breadcrumbHome: "首页",
		breadcrumbProducts: "能力参考",
		layerLabel: "所属层次",
		related: "相关能力",
		readNext: "继续理解",
		enter: `进入 ${BRAND}`,
	},
	footer: {
		statement: "与所爱的故事相遇，让共同知识得以继承、创造与传播。",
		explore: "探索",
		project: "项目",
		source: `${GITHUB} 源代码`,
		mainSite: "主要网站",
		copyright: `© 2026 ${REZICS_INC}`,
		license: AGPL30,
	},
	notFound: {
		title: "找不到这个页面",
		body: "网址可能已经改变，或这项内容还不存在。",
		back: "返回首页",
	},
} satisfies SiteCopy;
