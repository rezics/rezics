import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";
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
const FOLLOW = zhHantTerminology.follow.forms.actionLabel;
const REALM = zhHantTerminology.realm.forms.label;

export const zhHantContent = {
	nav: {
		home: "首頁",
		uses: "用途",
		products: "產品",
		enter: `進入 ${BRAND}`,
		language: "語言",
		theme: "顯示模式",
		openMenu: "開啟選單",
		closeMenu: "關閉選單",
	},
	theme: { light: "淺色", dark: "深色", toggle: "切換顯示模式" },
	a11y: {
		skipContent: "跳到主要內容",
		primaryNavigation: "主要導覽",
		utilityNavigation: "實用工具",
		home: `${BRAND} 首頁`,
	},
	meta: {
		home: {
			title: `${BRAND} — 與所愛的故事相遇`,
			description: `跨平台、跨語言找到網路小說，${FOLLOW}連載，並在${REALM}遇見同好。`,
		},
		uses: {
			title: `用途 — ${BRAND}`,
			description: `探索讀者如何跨平台尋書、${FOLLOW}連載、保存進度並找到同好。`,
		},
		products: {
			title: `產品 — ${BRAND}`,
			description: `以跨語言書單、標籤與社群分類、維基及${REALM}，讓作品跨越語言、平台與社群持續累積價值。`,
		},
	},
	home: {
		eyebrow: "傳承 · 創作 · 傳播",
		title: "與所愛的故事相遇。",
		lead: `從散落在不同平台與語言中的網路小說開始。${BRAND} 將原名、譯名、連載來源、章節與社群重新連成同一部持續演進的作品。`,
		explore: "探索網路小說",
		productsAction: "探索產品",
		problem: {
			title: "一本連載，不該因平台、語言與譯名而變成碎片。",
			body: "讀者想找的是同一個故事，今天卻必須在平台頁、譯名條目、進度工具與討論群之間反覆辨認。作品更新了，這些碎片也不一定一起前進。",
		},
		promise: {
			title: "先把同一部作品接回來，再讓閱讀與社群自然生長。",
			body: `${BRAND} 以穩定作品身份作為共同起點。名稱可以跨語言，連載可以跨平台，章節可以繼續增加，${REALM}可以形成不同觀點；它們仍然指向同一個可理解、可追溯的作品。`,
		},
		principles: [
			{ title: "跨平台辨認", body: "平台網址是來源，不是作品唯一的身份。" },
			{ title: "跨語言理解", body: "原名、譯名與別名共同幫助讀者找到同一部作品。" },
			{ title: "持續演進", body: "連載、章節、版本、進度與討論都能在作品更新時繼續累積。" },
		],
		model: {
			title: "網路小說是入口，底層為所有持續演進的作品而設計。",
			body: "作品、來源、內容、結構、歷史與社群各自保留清楚邊界，再透過明確關係合作。",
			steps: [
				{ title: "作品身份", body: "跨語言名稱與跨平台來源回到同一個可治理的身份。" },
				{
					title: "來源與連載",
					body: "原始連載、翻譯來源、出版版本與更新狀態不再被壓成一個網址。",
				},
				{
					title: `閱讀與${FOLLOW}`,
					body: "內容結構保存章節脈絡，進度讓讀者從真正的位置繼續。",
				},
				{
					title: `${REALM}與共同知識`,
					body: `讀者圍繞共同興趣建立${zhHantTerminology.realm.forms.label}，讓討論、修正與發現長期留下來。`,
				},
			],
		},
		outcomes: {
			title: "先解決讀者今天的問題，再累積明天的作品網路。",
			body: `每一次找到、${FOLLOW}、加入社群與補充關係，都能降低下一位讀者的尋找成本。`,
			cards: [
				{ title: "找到", body: "從原名、譯名、別名或來源網址找到同一部網路小說。" },
				{ title: "繼續", body: "跟進連載更新，保存閱讀狀態與最後位置。" },
				{
					title: "相遇",
					body: `進入或建立${REALM}，找到願意長期討論同一部作品的人。`,
				},
			],
		},
		open: {
			title: "宏大的敘事必須建立在可驗證的基礎上。",
			body: `${BRAND} 以開放原始碼、帶版本語義的內容文件、${zhHantTerminology.publicationLicense.forms.label}與權限化 ${API} 建立長期可延伸的邊界；產品頁則清楚標示已可使用、開發中與規劃中的部分。`,
		},
		closing: {
			title: "從一部你正在追的網路小說開始。",
			body: `搜尋它的原名或譯名，保存閱讀脈絡，並看看是否已經有人為它建立${zhHantTerminology.realm.forms.label}。`,
			action: `進入 ${BRAND}`,
		},
		contact: {
			title: "有想法想和我們一起實現嗎？",
			body: "無論是產品合作、參與開源、內容模型，或任何值得被做得更好的建議，都歡迎與我們聊聊。",
			action: "聯繫我們",
		},
		v1: {
			identity: {
				title: "一本連載，不該因平台、語言與譯名而變成碎片。",
				body: `讀者想找的是同一個故事，今天卻必須在平台頁、譯名條目、進度工具與討論群之間反覆辨認。${BRAND} 先把它們接回同一個作品身份。`,
				sourcesTitle: "跨平台來源",
				sources: ["原始連載平台", "翻譯與授權來源", "出版及其他版本"],
				namesTitle: "原名與譯名",
				originalName: "原名、羅馬字與別名",
				translatedName: "各語言正式譯名與慣用名",
				updates: { title: "連載更新", body: "來源持續更新，作品身份不必重建。" },
				progress: { title: "閱讀進度", body: "知道作品更新到哪裡，也知道自己讀到哪裡。" },
				realm: { title: `${REALM}同好社群`, body: "從作品找到願意長期討論它的人。" },
				workTitle: "同一部持續演進的作品",
			},
			loop: {
				title: "從找到一本書，到形成一個不容易複製的作品網路。",
				body: `40 萬冊啟動目錄解決冷啟動；真正會持續累積的，是跨平台身份、跨語言關係、閱讀足跡與${REALM}社群記憶。`,
				steps: [
					{ title: "跨平台找到作品", body: "原名、譯名、別名與來源指向同一身份。" },
					{
						title: `${FOLLOW}連載與進度`,
						body: "知道在哪裡讀、更新到哪裡、自己讀到哪裡。",
					},
					{ title: `加入或建立${REALM}`, body: "從作品找到真正長期討論它的人。" },
					{ title: "貢獻來源與知識", body: "修正名稱、版本、關係與社群內容。" },
					{ title: "搜尋與推薦變得更好", body: "每次參與都降低下一位讀者的尋找成本。" },
				],
			},
			foundation: {
				title: "網路小說是入口，底層為所有持續演進的作品而設計。",
				body: `${BRAND} 把作品身份、來源、內容、結構、歷史與社群拆成清楚邊界，再讓它們以明確關係合作。`,
				pillars: [
					{
						title: "作品身份與來源",
						body: "跨語言名稱、平台來源、主條目／變體與合併治理。",
					},
					{
						title: "內容結構",
						body: "章節是可重用內容；結構管理順序、出現位置與連載演進。",
					},
					{
						title: `${BLOCK_SCHEMA} + ${PORTABLE_TEXT}`,
						body: `帶類型、鍵與版本語義的可演進文件；富文字不是裸 ${JSON}。`,
					},
					{
						title: `${REALM}與共同記憶`,
						body: "作品不被社群佔有，討論、治理與知識卻能長期累積。",
					},
				],
				closing: "從網路小說開始，建立作品與共同知識得以傳承、創作與傳播的網路。",
			},
		},
	},
	uses: {
		eyebrow: "讀者先得到價值",
		title: "找書、追更、接著讀，再遇見真正的同好。",
		lead: `讀者不需要先理解內容單元、區塊或內容結構。他們只需要從熟悉的書名、平台或語言開始；${BRAND} 在背後把身份與關係接好。`,
		resultLabel: "得到",
		journeys: [
			{
				title: "跨平台找到同一部網路小說",
				body: "從平台網址、原始連載、翻譯來源或出版版本進入，回到同一個作品身份。",
				result: "不再把每個平台條目當成不同的書。",
			},
			{
				title: "用任何熟悉的語言找到它",
				body: "原名、羅馬字、正式譯名與社群慣用名共同成為搜尋入口，並保留各自語言脈絡。",
				result: "跨過語言，不必重新認識同一部作品。",
			},
			{
				title: `${FOLLOW}連載並從上次的位置繼續`,
				body: "查看來源更新到哪一章、作品處於連載或完結狀態，並保存自己的閱讀狀態與最後位置。",
				result: "作品在更新，閱讀脈絡不必重來。",
			},
			{
				title: `加入或建立${REALM}`,
				body: `從作品頁進入${zhHantTerminology.realm.forms.label}，圍繞同一部作品、類型或閱讀口味形成長期討論與共同規則。`,
				result: "從找到作品，進一步找到真正的同好。",
			},
			{
				title: "補充來源、名稱與作品關係",
				body: "協助修正譯名、平台來源、系列、發行、創作者與主題關係，並保留治理與歷史脈絡。",
				result: "每次修正都幫助下一位讀者更快找到答案。",
			},
			{
				title: "發布自己的文章與作品內容",
				body: `以 ${PORTABLE_TEXT} 編輯${zhHantTerminology.post.forms.label}，用 ${BLOCK_SCHEMA} 保存可演進文件，並以內容結構安排章節與發布歷史。`,
				result: "內容不只可閱讀，也能被引用、重用與持續修訂。",
			},
			{
				title: "用開放介面建立新的入口",
				body: `開發者目前可透過 ${API} 與權杖存取明確範圍；${OAUTH} 與 ${MCP} 整合則依各產品頁所標示的階段逐步開放。`,
				result: "公開現在能用什麼，也公開下一步要往哪裡走。",
			},
		],
		closing: {
			title: "想看見這些用途背後，哪些產品正在一起運作？",
			body: "每個產品頁先說明它為使用者完成什麼，再展開共同參與的產品、目前階段與彼此關係。",
			action: "探索產品",
		},
	},
	products: {
		eyebrow: "產品",
		title: "讓作品被找到、理解、收藏，也被共同延續。",
		lead: `跨語言書單、標籤與社群分類、維基及${REALM}都回到同一部作品。每一個新名稱、來源、內容與社群，都能讓它繼續生長。`,
		openProduct: "查看產品",
		stage: {
			legend: "產品狀態",
			current: "目前狀態",
			labels: { available: "已可使用", development: "開發中", planned: "規劃中" },
		},
	},
	product: {
		breadcrumbHome: "首頁",
		breadcrumbProducts: "產品",
		related: "共同參與的產品",
		readNext: "沿著產品關係繼續探索",
		enter: `進入 ${BRAND}`,
	},
	footer: {
		statement: "與所愛的故事相遇，讓共同知識得以繼承、創造與傳播。",
		explore: "探索",
		project: "專案",
		source: `${GITHUB} 原始碼`,
		mainSite: "主要網站",
		copyright: `© 2026 ${REZICS_INC}`,
		license: AGPL30,
	},
	notFound: {
		title: "找不到這個頁面",
		body: "網址可能已經變更，或這項內容尚未存在。",
		back: "回到首頁",
	},
} satisfies SiteCopy;
