import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { SiteCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const API = verbatimTerms.api.value;
const OAUTH = verbatimTerms.oauth.value;
const MCP = verbatimTerms.mcp.value;
const BLOCK_SCHEMA = verbatimTerms.blockSchema.value;
const PORTABLE_TEXT = verbatimTerms.portableText.value;
const JSON = verbatimTerms.json.value;
const GITHUB = verbatimTerms.github.value;
const REZICS_INC = verbatimTerms.rezicsInc.value;
const AGPL30 = verbatimTerms.agpl30.value;
const FOLLOW = zhHansTerminology.follow.forms.actionLabel;
const REALM = zhHansTerminology.realm.forms.label;

export const zhHansContent = {
	nav: {
		home: "首页",
		uses: "用途",
		products: "产品",
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
			description: `跨平台、跨语言找到网络小说，${FOLLOW}连载，并在${REALM}遇见同好。`,
		},
		uses: {
			title: `用途 — ${BRAND}`,
			description: `探索读者如何跨平台寻书、${FOLLOW}连载、保存进度并找到同好。`,
		},
		products: {
			title: `产品 — ${BRAND}`,
			description: `以原生多语言单元作为共同基础，再通过跨语言书单、标签与社区分类、维基及${REALM}，让作品跨越语言、平台与社区持续积累价值。`,
		},
	},
	home: {
		eyebrow: "传承 · 创作 · 传播",
		title: "与所爱的故事相遇。",
		lead: `从散落在不同平台与语言中的网络小说开始。${BRAND} 将原作与各语言呈现、连载来源、章节及社区重新连成同一部持续演进的作品。`,
		explore: "探索网络小说",
		productsAction: "探索产品",
		problem: {
			title: "一本连载，不该因平台、语言与译名而变成碎片。",
			body: "读者想找的是同一个故事，今天却必须在平台页、译名条目、进度工具与讨论群之间反复辨认。作品更新了，这些碎片也不一定一起前进。",
		},
		promise: {
			title: "先把同一部作品接回来，再让阅读与社区自然生长。",
			body: `${BRAND} 以原生多语言单元作为共同起点。同一部作品可以承载多种内容语言，连载可以跨平台，章节可以继续增加，${REALM}可以形成不同观点；原作、翻译与社区仍共享同一个可理解、可追溯的身份。`,
		},
		principles: [
			{ title: "跨平台辨认", body: "平台网址是来源，不是作品唯一的身份。" },
			{
				title: "跨语言理解",
				body: "原名、译名与别名共同帮助读者找到同一部作品。",
			},
			{
				title: "持续演进",
				body: "连载、章节、版本、进度与讨论都能在作品更新时继续累积。",
			},
		],
		model: {
			title: "网络小说是入口，底层为所有持续演进的作品而设计。",
			body: "作品、来源、内容、结构、历史与社区各自保留清楚边界，再通过明确关系合作。",
			steps: [
				{
					title: "原生多语言单元",
					body: "同一个作品身份原生承载各语言呈现，名称、内容与平台来源不必拆成互不相连的条目。",
				},
				{
					title: "来源与连载",
					body: "原始连载、翻译来源、出版版本与更新状态不再被压成一个网址。",
				},
				{
					title: `阅读与${FOLLOW}`,
					body: "内容结构保留章节上下文，进度让读者从真正的位置继续。",
				},
				{
					title: `${REALM}与共同知识`,
					body: `读者围绕共同兴趣建立${zhHansTerminology.realm.forms.label}，让讨论、修正与发现长期留下来。`,
				},
			],
		},
		outcomes: {
			title: "先解决读者今天的问题，再累积明天的作品网络。",
			body: `每一次找到、${FOLLOW}、加入社区与补充关系，都能降低下一位读者的寻找成本。`,
			cards: [
				{
					title: "找到",
					body: "从原名、译名、别名或来源网址找到同一部网络小说。",
				},
				{ title: "继续", body: "跟进连载更新，保存阅读状态与最后位置。" },
				{
					title: "相遇",
					body: `进入或建立${REALM}，找到愿意长期讨论同一部作品的人。`,
				},
			],
		},
		open: {
			title: "宏大的叙事必须建立在可验证的基础上。",
			body: `${BRAND} 以开放源代码、带版本语义的内容文档、${zhHansTerminology.publicationLicense.forms.label}与受权限控制的 ${API} 建立长期可延伸的边界；产品页则明确标示已可使用、开发中与规划中的部分。`,
		},
		closing: {
			title: "从一部你正在追的网络小说开始。",
			body: `搜索它的原名或译名，保留阅读上下文，并看看是否已经有人为它建立${zhHansTerminology.realm.forms.label}。`,
			action: `进入 ${BRAND}`,
		},
		contact: {
			title: "有想法想和我们一起实现吗？",
			body: "无论是产品合作、参与开源、内容模型，或任何值得被做得更好的建议，都欢迎与我们聊聊。",
			action: "联系我们",
		},
		v1: {
			identity: {
				title: "一本连载，不该因平台、语言与译名而变成碎片。",
				body: `读者想找的是同一个故事，今天却必须在平台页、译名条目、进度工具与讨论群之间反复辨认。${BRAND} 先把它们接回同一个作品身份。`,
				sourcesTitle: "跨平台来源",
				sources: ["原始连载平台", "翻译与授权来源", "出版及其他版本"],
				namesTitle: "原名与译名",
				originalName: "原名、罗马字与别名",
				translatedName: "各语言正式译名与常用名",
				updates: {
					title: "连载更新",
					body: "来源持续更新，作品身份不必重建。",
				},
				progress: {
					title: "阅读进度",
					body: "知道作品更新到哪里，也知道自己读到哪里。",
				},
				realm: {
					title: `${REALM}同好社区`,
					body: "从作品找到愿意长期讨论它的人。",
				},
				workTitle: "同一部持续演进的作品",
			},
			loop: {
				title: "从找到一本书，到形成一个不容易复制的作品网络。",
				body: `40 万册启动目录解决冷启动；真正会持续累积的，是跨平台身份、跨语言关系、阅读足迹与${REALM}社区记忆。`,
				steps: [
					{
						title: "跨平台找到作品",
						body: "原名、译名、别名与来源指向同一身份。",
					},
					{
						title: `${FOLLOW}连载与进度`,
						body: "知道在哪里读、更新到哪里、自己读到哪里。",
					},
					{
						title: `加入或建立${REALM}`,
						body: "从作品找到真正长期讨论它的人。",
					},
					{ title: "贡献来源与知识", body: "修正名称、版本、关系与社区内容。" },
					{
						title: "搜索与推荐变得更好",
						body: "每次参与都降低下一位读者的寻找成本。",
					},
				],
			},
			foundation: {
				title: "网络小说是入口，底层为所有持续演进的作品而设计。",
				body: `${BRAND} 把作品身份、来源、内容、结构、历史与社区拆成清楚边界，再让它们以明确关系合作。`,
				pillars: [
					{
						title: "原生多语言单元",
						body: "同一个作品身份承载各语言呈现、平台来源、主条目／变体与合并治理。",
					},
					{
						title: "内容结构",
						body: "章节是可重用内容；结构管理顺序、出现位置与连载演进。",
					},
					{
						title: `${BLOCK_SCHEMA} + ${PORTABLE_TEXT}`,
						body: `带类型、键与版本语义的可演进文档；富文字不是裸 ${JSON}。`,
					},
					{
						title: `${REALM}与共同记忆`,
						body: "作品不被社区占有，讨论、治理与知识却能长期累积。",
					},
				],
				closing: "从网络小说开始，建立作品与共同知识得以传承、创作与传播的网络。",
			},
		},
	},
	uses: {
		eyebrow: "读者先得到价值",
		title: "找书、追更、接着读，再遇见真正的同好。",
		lead: `读者不需要先理解内容单元、区块或内容结构。他们只需要从熟悉的书名、平台或语言开始；${BRAND} 在背后把身份与关系接好。`,
		resultLabel: "得到",
		journeys: [
			{
				title: "跨平台找到同一部网络小说",
				body: "从平台网址、原始连载、翻译来源或出版版本进入，回到同一个作品身份。",
				result: "不再把每个平台条目当成不同的书。",
			},
			{
				title: "用熟悉的语言找到并理解它",
				body: "原名、罗马字与社区常用名共同成为搜索入口；进入同一个单元后，再显示符合读者偏好的名称、摘要与内容。",
				result: "跨过语言，也不必离开原作与已有社区。",
			},
			{
				title: `${FOLLOW}连载并从上次的位置继续`,
				body: "查看来源更新到哪一章、作品处于连载或完结状态，并保存自己的阅读状态与最后位置。",
				result: "作品在更新，阅读上下文不必重来。",
			},
			{
				title: `加入或建立${REALM}`,
				body: `从作品页进入${zhHansTerminology.realm.forms.label}，围绕同一部作品、类型或阅读口味形成长期讨论与共同规则。`,
				result: "从找到作品，进一步找到真正的同好。",
			},
			{
				title: "补充来源、名称与作品关系",
				body: "协助修正译名、平台来源、系列、发行、创作者与主题关系，并保留治理与历史上下文。",
				result: "每次修正都帮助下一位读者更快找到答案。",
			},
			{
				title: "发布自己的文章与作品内容",
				body: `以 ${PORTABLE_TEXT} 编辑${zhHansTerminology.post.forms.label}，用 ${BLOCK_SCHEMA} 保存可演进文档，并以内容结构安排章节与发布历史。`,
				result: "内容不只可阅读，也能被引用、重用与持续修订。",
			},
			{
				title: "用开放接口建立新的入口",
				body: `开发者当前可通过 ${API} 与令牌访问明确范围；${OAUTH} 与 ${MCP} 整合则依各产品页所标示的阶段逐步开放。`,
				result: "明确当前可用的能力，也明确下一步的发展方向。",
			},
		],
		closing: {
			title: "想看见这些用途背后，哪些产品正在一起运作？",
			body: "每个产品页先说明它为用户完成什么，再展开共同参与的产品、当前阶段与彼此关系。",
			action: "探索产品",
		},
	},
	products: {
		eyebrow: "产品",
		title: "让作品被找到、理解、收藏，也被共同延续。",
		lead: `每部作品先以原生多语言单元保存各语言呈现、关系与修订，再由跨语言书单、标签与社区分类、维基及${REALM}带到不同语言的读者与社区。`,
		openProduct: "查看产品",
		stage: {
			legend: "产品状态",
			current: "当前状态",
			labels: {
				available: "已可使用",
				development: "开发中",
				planned: "规划中",
			},
		},
	},
	product: {
		breadcrumbHome: "首页",
		breadcrumbProducts: "产品",
		related: "共同参与的产品",
		readNext: "沿着产品关系继续探索",
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
		body: "网址可能已经变更，或这项内容尚未存在。",
		back: "回到首页",
	},
} satisfies SiteCopy;
