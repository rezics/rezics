import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { SiteCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const API = verbatimTerms.api.value;
const OAUTH = verbatimTerms.oauth.value;
const MCP = verbatimTerms.mcp.value;
const AI = verbatimTerms.ai.value;
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
			description: `跨平台、跨语言找到网络小说，${FOLLOW}连载，并在${REALM}遇见同好。`,
		},
		how: {
			title: `运作原理 — ${BRAND}`,
			description: `理解 ${BRAND} 如何以共享作品身份连接跨平台来源，再以语言、${REALM}、标签投票与个人作用域保留不同语境。`,
		},
		uses: {
			title: `用途 — ${BRAND}`,
			description: `探索读者如何跨平台寻书、${FOLLOW}连载、保存进度并找到同好。`,
		},
		products: {
			title: `能力地图 — ${BRAND}`,
			description: `分辨 ${BRAND} 已可使用、开发中与规划中的作品、内容、社区及开放能力。`,
		},
	},
	home: {
		eyebrow: "传承 · 创作 · 传播",
		title: "与所爱的故事相遇。",
		lead: `从散落在不同平台与语言中的网络小说开始。${BRAND} 将原名、译名、连载来源、章节与社区重新连成同一部持续演进的作品。`,
		explore: "探索网络小说",
		understand: `理解 ${BRAND}`,
		problem: {
			title: "一本连载，不该因平台、语言与译名而变成碎片。",
			body: "读者想找的是同一个故事，今天却必须在平台页、译名条目、进度工具与讨论群之间反复辨认。作品更新了，这些碎片也不一定一起前进。",
		},
		promise: {
			title: "先把同一部作品接回来，再让阅读与社区自然生长。",
			body: `${BRAND} 以稳定作品身份作为共同起点。名称可以跨语言，连载可以跨平台，章节可以继续增加，${REALM}可以形成不同观点；它们仍然指向同一个可理解、可追溯的作品。`,
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
					title: "作品身份",
					body: "跨语言名称与跨平台来源回到同一个可治理的身份。",
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
			body: `${BRAND} 以开放源代码、带版本语义的内容文档、${zhHansTerminology.publicationLicense.forms.label}与受权限控制的 ${API} 建立长期可延伸的边界；能力地图则明确区分已可使用、开发中与规划中的部分。`,
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
			focus: {
				label: "第一版，从现在开始",
				items: ["启动计划｜首批 40 万册", "跨平台来源", "跨语言作品身份", `${REALM}同好社区`],
			},
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
						title: "作品身份与来源",
						body: "跨语言名称、平台来源、主条目／变体与合并治理。",
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
	how: {
		eyebrow: "作品网络如何形成",
		title: "同一部作品，可以跨平台、跨语言，也可以在不同社区里被重新理解。",
		lead: `${BRAND} 先让作品、来源与关系指向共享身份，再把语言呈现、${REALM}语境、标签投票与个人偏好放回各自的作用域。共享的部分不必复制，应保留差异的部分也不会被压成全站唯一答案。`,
		stages: [
			{
				title: "1. 跨平台作品身份",
				body: "原始连载、翻译来源、授权平台与出版版本保持差异，却能回到同一个可治理的作品网络。",
			},
			{
				title: "2. 共享模型与语言呈现",
				body: "作品、书单、顺序与关系超越语言；名称、摘要与内容则依读者语言呈现。",
			},
			{
				title: `3. ${REALM}作用域`,
				body: `同一单元可以进入多个${REALM}；每个社区管理自己的发布关系、规则与策展，却不取得原始内容所有权。`,
			},
			{
				title: "4. 标签＋投票",
				body: `全局判断、${REALM}判断、政策标签与个人整理各自保留，分类不必冒充唯一真相。`,
			},
			{
				title: `5. ${BLOCK_SCHEMA} 与 ${PORTABLE_TEXT}`,
				body: "文档、内容、出现位置、顺序与发布历史各有边界，让长篇连载与共同知识可以持续演进。",
			},
			{
				title: "6. 从发现回到共同建造",
				body: "寻找、阅读、加入社区与补充知识形成循环，让每次参与都降低下一位读者的寻找成本。",
			},
		],
		integrity: {
			title: "共享身份，不代表抹平所有差异。",
			body: `作品与来源需要共同基础；${REALM}需要自己的治理与投票语境；个人进度与整理则只属于本人。${BRAND} 的核心不是把所有数据集中成一个答案，而是让每一种答案停留在正确的作用域，仍能通过同一个作品网络彼此连接。`,
		},
		v1: {
			scope: {
				title: "先分清楚，什么必须共享，什么应该保留差异。",
				body: `同一部作品可以跨越平台、语言与社区，但不同层次拥有不同权力。这组边界决定数据能否重用，也决定${REALM}与个人是否保有真正的自主性。`,
				layers: [
					{
						title: "共享层",
						body: "跨平台、跨语言仍指向同一组可追溯的作品基础。",
						items: [
							"作品、人物、系列与标签的稳定身份",
							"平台来源、版本、系列与其他明确关系",
							"各语言名称、摘要及可重用的内容结构",
						],
					},
					{
						title: `${REALM}作用域`,
						body: "社区针对共享对象建立自己的发布关系、治理与分类观点。",
						items: [
							`单元进入${REALM}的发布与停靠关系`,
							"规则、内容治理、维基、导航与策展",
							`${REALM}标签语境、投票与排序`,
						],
					},
					{
						title: "个人层",
						body: "只改变自己的阅读与整理方式，不冒充公共事实。",
						items: [
							"界面语言与内容语言偏好",
							`阅读进度、收藏与${FOLLOW}状态`,
							"个人标签与只属于自己的判断",
						],
					},
				],
			},
			mechanisms: {
				title: "五个互相咬合的核心机制",
				body: "每一项都解决不同问题；只有把它们放在一起，跨语言发现、社区策展与共同治理才会形成长期累积。",
				exampleLabel: "具体情境",
				ruleLabel: "不变的边界",
				capabilityLabel: "对照能力与当前状态",
				items: [
					{
						title: "一部作品，不再被平台切碎",
						body: `网络小说可能同时存在于原始连载、翻译与授权平台、出版版本及其他来源。${BRAND} 不把任何一家平台当成作品边界，而是让入口保持来源证据，再连回稳定身份。`,
						points: [
							`稳定 ${verbatimTerms.id.value} 不依赖单一网址、书名或语言`,
							"主条目／变体关系保留版本差异，不假装所有条目完全相同",
							"来源说明作品在哪里出现，不取代身份或所有权证明",
						],
						example: {
							title: "一部连载，从三个入口被找到",
							body: "读者可以从原始连载、中文翻译来源或出版版本进入；每个入口保留自己的信息，同时回到同一部作品的来源、版本与社区语境。",
						},
						rule: "平台网址是来源，不是作品唯一身份；作品被引用或发布，也不等于所有权发生转移。",
					},
					{
						title: "共享模型，语言各自呈现",
						body: "作品身份、书单成员、策展顺序与关系不绑定某一种语言；原名、译名、摘要与内容则依语言分开维护。界面语言和内容语言偏好也各自决定不同事情。",
						points: [
							"模型保存作品、关系、分组与顺序",
							"本地化保存名称、摘要与适合该语言的内容",
							"界面语言控制操作文字，内容偏好控制呈现及回退顺序",
						],
						example: {
							title: "日文书单，对中文读者仍然有价值",
							body: "建立者策展的是作品身份与顺序。中文读者打开同一份书单时，可以看到已有的中文名称与摘要；缺少本地化时才回退到其他语言，不会失去作品、顺序或来源。",
						},
						rule: "补充中文本地化内容是在完善同一份共享模型，不必另外复制一份中文版书单。",
					},
					{
						title: `${REALM}作用域：共享基础上的不同社区语境`,
						body: `同一个作品或其他单元可以进入多个${REALM}。每个${REALM}拥有自己的成员、规则、内容动态、维基、导航、策展与治理语境，但共享对象不会因此被复制或改换所有者。`,
						points: [
							`同一单元可以同时发布到多个${REALM}`,
							`每个${REALM}分别管理关系状态、规则与呈现`,
							`移除${REALM}中的关系，不会删除原始作品或${zhHansTerminology.post.forms.label}`,
						],
						example: {
							title: "同一部作品，可以被不同社区用不同方式理解",
							body: `翻译研究${REALM}可以整理译名与来源；类型读者${REALM}可以建立题材策展与讨论规则。两边引用同一作品，却不必共用同一套社区判断。`,
						},
						rule: `${REALM}治理的是发布关系与社区语境，不会因内容出现在其中就取得原始内容所有权。`,
					},
					{
						title: "标签＋投票：分类是一种有作用域的判断",
						body: `标签本身是可本地化、可跨产品重用的身份；某个标签是否适用，则可以由全局社区、特定${REALM}、治理者或个人分别表达。这让分类能形成共识，也允许不同语境保留差异。`,
						points: [
							"全局社区投票：累积整个平台的判断",
							`${REALM}语境投票：只在该社区的规则与排序中生效`,
							`${REALM}政策标签：由治理者直接维护`,
							"个人标签：只服务自己的整理方式",
						],
						example: {
							title: "「异世界」可以是共享术语，也可以有社区判断",
							body: `标签名称与多语言说明可以共享；某部作品是否适用这个标签，则能分别呈现全局与${REALM}投票结果。个人也能使用自己的标签，而不把它宣称为公共事实。`,
						},
						rule: `全局投票不得和${REALM}投票合并；治理者的置顶或政策判断也不会被计算成社区赞成票。`,
					},
					{
						title: `${BLOCK_SCHEMA}＋${PORTABLE_TEXT}：内容可以持续演进`,
						body: `${BRAND} 将文档内容、内容出现的位置、章节顺序与发布历史分开建模。${PORTABLE_TEXT} 编辑器直接生成结构化富文字；${BLOCK_SCHEMA} 为区块提供类型、稳定键、版本与验证边界。`,
						points: [
							`${BLOCK_SCHEMA} 使用封闭的区块类型，不让未知内容默默通过`,
							`${PORTABLE_TEXT} 编辑器生成可验证、可引用的结构化内容`,
							"内容结构安排出现位置与顺序，历史保存已发布修订",
						],
						example: {
							title: "正文是一份内容，章节位置是另一份关系",
							body: "同一篇章节可以被内容结构安排到正确位置，必要时也能重用；调整目录顺序不必复制正文，发布与还原则以明确修订保留历史。",
						},
						rule: "编辑器生成并验证文档；内容单元拥有正文；内容结构安排出现位置；发布历史保存可追溯修订。",
					},
				],
			},
			loop: {
				title: "这些机制最后回到同一个循环",
				body: "首批 40 万册建立可进入的起点；真正持续增长的，是作品身份、跨语言关系、社区语境与共同判断之间的连接。",
				steps: [
					{
						title: "跨平台、跨语言发现",
						body: "从熟悉的名称或来源找到同一部作品。",
					},
					{
						title: `阅读、收藏与${FOLLOW}`,
						body: "保存自己的进度与长期兴趣。",
					},
					{
						title: `加入或建立${REALM}`,
						body: "进入适合的社区语境与治理规则。",
					},
					{
						title: "补充来源、内容与判断",
						body: "贡献本地化、关系、标签与投票。",
					},
					{
						title: "让下一次发现更准确",
						body: "共同知识回到搜索、策展与推荐。",
					},
				],
				closing:
					"不是任何一项功能单独形成护城河，而是每次发现都可能带来新的语境，每次贡献又让下一次发现更好。",
				capabilitiesAction: "查看完整能力地图",
				usesAction: "探索实际用途",
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
				title: "用任何熟悉的语言找到它",
				body: "原名、罗马字、正式译名与社区常用名共同成为搜索入口，并保留各自的语言语境。",
				result: "跨过语言，不必重新认识同一部作品。",
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
				body: `开发者当前可通过 ${API} 与令牌访问明确范围；${OAUTH} 与 ${MCP} 整合则依能力地图所标示的阶段逐步开放。`,
				result: "明确当前可用的能力，也明确下一步的发展方向。",
			},
		],
		closing: {
			title: "想分清当前可用、正在建设与长期方向？",
			body: "能力地图为每一项能力标示阶段，再用完整文档说明它和作品网络的关系。",
			action: "浏览能力地图",
		},
	},
	products: {
		eyebrow: "能力地图",
		title: "从网络小说开始，看见整个作品网络。",
		lead: "这里同时记录已可使用的能力、正在建设的系统与已公开的设计方向。状态标记说明当前情况；完整文档说明它们将如何合作。",
		searchLabel: "搜索能力",
		searchPlaceholder: "搜索名称、用途或状态",
		allLayers: "全部",
		empty: "没有符合条件的能力。",
		openProduct: "查看能力",
		stage: {
			legend: "能力状态",
			current: "当前状态",
			labels: {
				available: "已可使用",
				development: "开发中",
				planned: "规划中",
			},
		},
		layers: {
			identity: {
				title: "作品身份",
				body: `辨认同一部作品，连接来源、版本、系列、${zhHansTerminology.entity.forms.label}与分类。`,
			},
			form: {
				title: "阅读与内容",
				body: "承载网络小说、文章、媒体、评论与回复。",
			},
			structure: {
				title: "结构与历史",
				body: "组合内容，保存区块身份、发布修订与演进上下文。",
			},
			community: {
				title: "社区与探索",
				body: `收藏、${FOLLOW}、保存进度、加入${zhHansTerminology.realm.forms.label}并让发现持续循环。`,
			},
			open: {
				title: "开放接口",
				body: `以明确权限连接工具、服务、${AI} 与新的作品入口。`,
			},
		},
	},
	product: {
		breadcrumbHome: "首页",
		breadcrumbProducts: "能力地图",
		layerLabel: "所属层次",
		related: "相关能力",
		readNext: "沿着关系继续理解",
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
