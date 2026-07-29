import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { ProductFamilyId } from "../../productTypes";

const rezics = verbatimTerms.rezics.value;
const github = verbatimTerms.github.value;
const outline = verbatimTerms.outline.value;
const react = verbatimTerms.react.value;
const vike = verbatimTerms.vike.value;
const agpl30 = verbatimTerms.agpl30.value;
const edgeCoordinates = verbatimTerms.edgeCoordinates.value;
const edgeCoordinatesEmail = verbatimTerms.edgeCoordinatesEmail.value;
const api = verbatimTerms.api.value;
const oauth = verbatimTerms.oauth.value;
const post = zhHantTerminology.post.forms.label;
const realm = zhHantTerminology.realm.forms.label;
const zone = zhHantTerminology.zone.forms.label;

const productFamilies = {
	discover: {
		index: "01",
		title: "認識作品與版本",
		prompt: "我想先弄清楚：這是什麼作品，它有哪些版本，又和哪些故事相連。",
		description:
			"從作品的穩定身分出發，整理書籍、媒體、軟體、系列與發行之間的關係，也保留人物、組織與主題的脈絡。",
	},
	create: {
		index: "02",
		title: "創作與整理內容",
		prompt: "我想寫下內容、安排結構，或為一部作品補上評論與知識。",
		description: `用${post}及其不同形態承載內容，讓編輯、內容結構、留言與評分各自負責清楚的工作。`,
	},
	continue: {
		index: "03",
		title: "收藏並繼續",
		prompt: "我想保存喜歡的故事，知道自己看到哪裡，並跟上新的內容。",
		description: `以收藏、書庫、${realm}與${zone}組織長期收藏，再由動態與進度把下一次回來的位置接上。`,
	},
	open: {
		index: "04",
		title: "連結開放平台",
		prompt: `我想理解版本歷史，或讓其他工具安全地連接 ${rezics}。`,
		description: `歷史保留已發布內容的變化；${api}、${oauth} 與權杖則讓外部工具在明確權限下連接產品能力。`,
	},
} as const satisfies Record<
	ProductFamilyId,
	{
		readonly index: string;
		readonly title: string;
		readonly prompt: string;
		readonly description: string;
	}
>;

export const zhHantContent = {
	common: {
		siteName: rezics,
		nav: {
			home: "首頁",
			products: "產品",
			github,
			language: "語言",
		},
		theme: {
			toggle: "切換明暗主題",
			light: "淺色主題",
			dark: "深色主題",
		},
		a11y: {
			skipContent: "跳到主要內容",
			primaryNavigation: "主要導覽",
			home: `${rezics} 首頁`,
			breadcrumb: "麵包屑",
			utilityNavigation: "網站工具",
		},
		actions: {
			exploreProducts: "探索產品",
			learnAbout: `了解 ${rezics}`,
			viewAllProducts: "查看所有產品",
			viewProduct: "了解這項產品",
			backHome: "回到首頁",
			contact: "聯繫我們",
			sendEmail: "寄送電子郵件",
			visitGithub: `前往 ${github}`,
		},
		notFound: {
			title: "找不到這個頁面",
			body: "這個連結可能不存在，或尚未成為公開產品頁。",
		},
	},
	home: {
		meta: {
			title: `${rezics}: 與所愛的故事相遇`,
			description: `${rezics} 讓作品、內容與閱讀歷史保持可辨認、可理解，也能繼續被帶往下一段旅程。`,
		},
		hero: {
			title: `${rezics}: 與所愛的故事相遇`,
			description:
				"讓每一部作品保有名字，讓內容之間的關係被理解，\n也讓你與故事共同走過的時間可以繼續。",
		},
		origin: {
			title: "故事不該因為離開一個平台，就失去名字。",
			body: "我們想做的不是另一個封閉的內容平台，而是一套能陪故事走得更遠的開放產品。作品可以被辨認，內容可以被重新組織，已發布的改變也能留下歷史。",
			imageAlt: `一本紅色的 ${rezics} 書籍放在地圖、手稿、照片與鋼筆之間。`,
			principles: [
				{
					title: "身分",
					body: "先知道這是誰、是哪一部作品，再談版本、內容與關係。",
				},
				{
					title: "結構",
					body: "讓同一份內容能被安排、重用與連結，而不必反覆複製。",
				},
				{
					title: "歷史",
					body: "記住正式發布的改變，讓今天仍能理解故事如何走到這裡。",
				},
			],
		},
		products: {
			title: "從你關心的故事開始。",
			description:
				"不需要先記住二十六個產品。告訴我們你想做什麼，再沿著最接近你的入口往下走。",
		},
		open: {
			title: "開放，才能讓熱愛走得長久。",
			body: `資料可以帶走，歷史可以理解，連接方式可以被檢查。${rezics} 在公開文件與原始碼中持續成長，也歡迎不同故事、社群與工具加入。`,
		},
		contact: {
			title: "有想一起完成的事嗎？",
			introduction: "如果你正在想這些事情，歡迎先告訴我們你的想法。",
			reasons: [
				`想討論產品合作，或把某種故事形式帶進 ${rezics}。`,
				"想參與開源開發、文件整理或社群建設。",
				"對內容身分、結構、歷史或資料可攜有問題。",
			],
		},
	},
	contact: {
		meta: {
			title: `聯繫我們 — ${rezics}`,
			description: `與 ${rezics} 專案維護者討論產品合作、開源參與、內容模型與其他建議。`,
		},
		hero: {
			title: "聯繫我們",
			description:
				"無論你想帶來一種新的故事形式、參與開源建設，或只是發現某件值得被做得更好的事，我們都願意聽你說。",
		},
		topicsTitle: "我們可以從這些事情開始",
		topics: [
			{
				title: "產品與內容合作",
				body: `討論如何讓出版社、創作者、社群或內容工具連接 ${rezics} 的作品、結構與歷史能力。`,
			},
			{
				title: "參與開源建設",
				body: "一起改善程式、文件、設計、研究與社群，讓開放的內容基礎設施真正能被使用。",
			},
			{
				title: "問題與建議",
				body: "回報問題，或告訴我們哪些產品邊界、資料關係與使用流程仍然不夠清楚。",
			},
		],
		maintainer: {
			title: "直接聯繫專案維護者",
			description: "來信請簡單說明你的背景、想討論的事情，以及希望我們如何回覆。",
			name: edgeCoordinates,
			role: "專案維護者",
			emailLabel: "電子郵件",
			email: edgeCoordinatesEmail,
			githubLabel: github,
		},
	},
	products: {
		meta: {
			title: `產品 — ${rezics}`,
			description: `從閱讀、創作、收藏與開放連接的目的出發，找到適合的 ${rezics} 產品。`,
		},
		hero: {
			title: "先選擇你想前往的方向。",
			description: `${rezics} 的產品不是一張要背下來的功能清單。\n從你的目的開始，每一條路都會帶你找到正確的產品。`,
		},
		familiesTitle: "四條開始的路",
		allTitle: "完整產品總覽",
		families: productFamilies,
		common: {
			labels: {
				related: "接著可以認識",
				parent: "建立在這項產品上",
				demo: "直接試試看",
				loading: "載入產品內容⋯⋯",
			},
		},
		demos: {
			gamebook: {
				title: "霧港檔案",
				description: "你在關閉的檔案館門前找到兩條路。",
				choices: [
					{
						label: "沿著燈光進入側門",
						result: "你找到仍在工作的管理員，並取得下一段路徑。",
					},
					{
						label: "先回到車站查閱地圖",
						result: "你保留這次旅程，準備從新的線索再次出發。",
					},
				],
				resultLabel: "這次選擇",
			},
			structure: {
				title: "同一份內容，不同的出現位置",
				description: "選擇一個出現位置，看看它在目錄中負責什麼。",
				nodes: [
					{
						label: "序章",
						detail: `閱讀入口；內容來自一篇${post}，並保留自己的穩定位置。`,
					},
					{
						label: "第一部",
						detail: "容納三個章節的群組；調整順序不會複製章節內容。",
					},
					{
						label: "補遺",
						detail: "同一份內容也能在另一個位置再次出現，並保有新的脈絡。",
					},
				],
				detailLabel: "出現位置說明",
			},
			history: {
				title: "只記錄正式發布的改變",
				description: "選擇一個版本，查看這次發布真正改變了什麼。",
				versions: [
					{
						label: "版本 3",
						meta: "目前版本",
						detail: "書名欄位已更新，章節目錄沒有改變。",
					},
					{
						label: "版本 2",
						meta: "上一次發布",
						detail: "新增補遺，並將第二章移到第一部之下。",
					},
					{
						label: "版本 1",
						meta: "首次發布",
						detail: "建立書籍基本資料與最初的三章目錄。",
					},
				],
				detailLabel: "發布差異",
			},
		},
	},
	footer: {
		statement: "讓每個故事，都能被認出、被理解，也能繼續被帶往下一段旅程。",
		copyright: `© ${rezics}`,
		groups: {
			products: "產品",
			platform: "平台",
			open: "開放",
		},
		links: {
			allProducts: "全部產品",
			docs: `${outline} 文件`,
			source: "原始碼",
			mainSite: "主要網站",
			contact: "聯繫我們",
		},
		implementation: `${agpl30} · 使用 ${vike} 與 ${react} 建置的靜態網站`,
	},
} as const;

export type LocaleContent = typeof zhHantContent;
