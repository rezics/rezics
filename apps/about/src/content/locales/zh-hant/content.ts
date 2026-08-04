import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { SiteCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const API = verbatimTerms.api.value;
const OAUTH = verbatimTerms.oauth.value;
const GITHUB = verbatimTerms.github.value;
const REZICS_INC = verbatimTerms.rezicsInc.value;
const AGPL30 = verbatimTerms.agpl30.value;

export const zhHantContent = {
	nav: {
		home: "首頁",
		how: "運作原理",
		uses: "用途",
		products: "能力參考",
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
			description: "以統一作品身份連接版本、內容、社群與跨語言知識。",
		},
		how: {
			title: `運作原理 — ${BRAND}`,
			description: `從作品身份開始，理解 ${BRAND} 如何連接內容、歷史與社群。`,
		},
		uses: {
			title: `用途 — ${BRAND}`,
			description: "探索讀者、社群、創作者與開發者如何使用同一套作品網路。",
		},
		products: {
			title: `能力參考 — ${BRAND}`,
			description: `完整瀏覽 ${BRAND} 的作品、內容、社群與開放能力。`,
		},
	},
	home: {
		eyebrow: "傳承 · 創作 · 傳播",
		title: "與所愛的故事相遇。",
		lead: `${BRAND} 是一個原生支援多語言的內容組織、發布與社群協作平台。它讓作品、${zhHantTerminology.metadata.forms.inline}、${zhHantTerminology.post.forms.plural}、收藏、分類與社群空間擁有各自穩定的身分，並能在同一套系統中被連結、創作、管理、探索、討論與治理。`,
		explore: "探索用途",
		understand: "理解運作原理",
		problem: {
			title: "我們愛的是同一部作品，找到的卻常是碎片。",
			body: "不同語言名稱、版本、媒體形態與社群平台各自建立條目。讀者要重複辨認，創作者的歸屬容易遺失，社群累積的知識也難以延續。",
		},
		promise: {
			title: "先辨認作品，再讓知識生長。",
			body: `${BRAND} 以穩定作品身份作為共同起點。名稱可以翻譯，內容可以演進，社群可以從不同角度組織，但它們仍指向同一個可理解、可追溯的對象。`,
		},
		principles: [
			{ title: "傳承", body: "作品已經擁有的歷史、語言、版本與社群記憶。" },
			{ title: "創作", body: "讓人們撰寫內容、建立結構、補充歸屬並形成新的理解。" },
			{ title: "傳播", body: "透過社群、開放協議與跨語言連結，讓知識繼續流動。" },
		],
		model: {
			title: "一個身份，逐層形成完整語境。",
			body: "底層模型把不該混淆的概念分開，再讓它們透過明確關係合作。",
			steps: [
				{ title: "作品身份", body: "作品擁有不隨語言與版面改變的穩定核心。" },
				{
					title: "版本與關係",
					body: `發行、系列、${zhHantTerminology.entity.forms.label}、標籤和歸屬把作品放回真實脈絡。`,
				},
				{ title: "內容與歷史", body: "內容結構、編輯與歷史保留順序、變更與可重用性。" },
				{
					title: "個人與社群",
					body: `收藏、${zhHantTerminology.realm.forms.label}、${zhHantTerminology.zone.forms.label}與動態把模型變成日常體驗。`,
				},
			],
		},
		outcomes: {
			title: "為讀者，也為作品本身。",
			body: "同一套基礎同時降低尋找成本、保留創作歸屬，讓作品遇上適合的讀者。",
			cards: [
				{ title: "找到", body: "跨語言辨認作品、版本與相關創作者，不再從零拼湊。" },
				{ title: "理解", body: "沿著結構、評論、維基、歷史與關係看見作品的完整脈絡。" },
				{
					title: "延續",
					body: "收藏進度、加入社群、補充知識，讓個人體驗成為共同記憶的一部分。",
				},
			],
		},
		open: {
			title: "開放不是附加功能，而是記憶得以延續的條件。",
			body: `${BRAND} 以開放原始碼、可攜內容、${zhHantTerminology.publicationLicense.forms.label}與權限化 ${API} 連接外部工具。社群不必把共同知識鎖在單一介面裡。`,
		},
		closing: {
			title: "從一部你在意的作品開始。",
			body: `進入主站，探索作品、${zhHantTerminology.realm.forms.label}與正在形成的共同知識。`,
			action: `進入 ${BRAND}`,
		},
		contact: {
			title: "有想法想和我們一起實現嗎？",
			body: "無論是產品合作、參與開源、內容模型，或任何值得被做得更好的建議，都歡迎與我們聊聊。",
			action: "聯繫我們",
		},
	},
	how: {
		eyebrow: "從底層開始",
		title: "不是更大的目錄，而是一套讓作品保持連結的方法。",
		lead: `${BRAND} 從身份、呈現、關係、內容、信任到探索逐層建立。每一層只承擔自己的意義，因此能在語言、媒體與社群之間延伸。`,
		stages: [
			{
				title: "1. 作品身份",
				body: `穩定 ${verbatimTerms.id.value} 辨認作品本身；本地化名稱與類型${zhHantTerminology.metadata.forms.label}可以演進，卻不會製造另一部作品。`,
			},
			{
				title: "2. 呈現與類型",
				body: "書籍、媒體、軟體等類型保留各自需要的欄位與體驗，同時共享身份與關係層。",
			},
			{
				title: "3. 關係與歸屬",
				body: `系列、發行、${zhHantTerminology.entity.forms.label}、標籤、創作歸屬與主題關聯，把作品放進可理解的網路。`,
			},
			{
				title: "4. 內容區塊與內容結構",
				body: "內容區塊表達可呈現內容；內容結構管理出現位置、順序、重用與分支，兩者不互相冒充。",
			},
			{
				title: "5. 歷史、授權與治理",
				body: `發佈邊界形成可追溯版本；${zhHantTerminology.publicationLicense.forms.label}、存取規則與社群治理說明誰能做什麼，以及知識如何被信任。`,
			},
			{
				title: "6. 探索表面",
				body: `搜尋、動態、${zhHantTerminology.realm.forms.label}與${zhHantTerminology.zone.forms.label}把底層網路轉成尋找、閱讀、參與和返回的日常路徑。`,
			},
		],
		integrity: {
			title: "分開保存意義，連起來形成價值。",
			body: "身份不是名稱，發行不是系列，內容區塊不是目錄節點，社群空間也不擁有它所引用的作品。清楚邊界讓每一條連結都能被解釋。",
		},
		interfaceTitle: "同一套模型，落在真實產品介面中。",
		interfaceBody: `公開的 ${BRAND} ${zhHantTerminology.realm.forms.label}頁把搜尋、社群語境、內容流與作品入口組合在一起。畫面來自主站公開頁面，不含個人帳號資料。`,
		screenshotAlt: `${BRAND} 公開${zhHantTerminology.realm.forms.label}頁，包含導覽、搜尋、${zhHantTerminology.realm.forms.label}標題與官方內容卡片。`,
		screenshotCaption: `公開介面實況 · ${BRAND} 官方${zhHantTerminology.realm.forms.label}`,
	},
	uses: {
		eyebrow: "從需要出發",
		title: "一套作品網路，多條真實旅程。",
		lead: `讀者不需要先理解資料模型。他們從尋找一本書、${zhHantTerminology.follow.forms.actionLabel}一個系列、加入一個社群或保存閱讀進度開始；底層連結在需要時自然出現。`,
		resultLabel: "得到",
		journeys: [
			{
				title: "跨語言找到同一部作品",
				body: "從熟悉的譯名、原名、作者、版本或媒體形態進入，逐步辨認它們的關係。",
				result: "少一次重複搜尋，多一個可信入口。",
			},
			{
				title: "理解版本與創作脈絡",
				body: `查看系列、發行、${zhHantTerminology.entity.forms.label}、角色、創作者與出版關係，不把所有差異壓成一條平面記錄。`,
				result: "知道自己正在看什麼，以及它從哪裡來。",
			},
			{
				title: "閱讀並貢獻內容",
				body: `沿著書籍結構閱讀，查看${zhHantTerminology.post.forms.label}、維基、圖片、評論與評分，也能補充自己的理解。`,
				result: "內容與作品身份保持相連。",
			},
			{
				title: "加入共同興趣的社群",
				body: `在${zhHantTerminology.realm.forms.label}裡形成共同規則，在${zhHantTerminology.zone.forms.label}裡策展特定視角，透過動態延續討論。`,
				result: "社群知識不再只是快速流逝的訊息。",
			},
			{
				title: "收藏、返回與繼續",
				body: "以收藏和書庫整理作品，以進度保存閱讀位置，下一次回來仍能接上原本脈絡。",
				result: "個人旅程與共同知識互相支援。",
			},
			{
				title: "出版、歸屬與授權",
				body: `創作者和組織建立內容結構、標示貢獻關係、選擇${zhHantTerminology.publicationLicense.forms.label}並保留發佈歷史。`,
				result: "作品能被理解、引用，也能保留應有歸屬。",
			},
			{
				title: "建立工具與新的入口",
				body: `開發者透過 ${API}、${OAUTH} 與權杖取得明確範圍，把搜尋、編輯或社群工作流接到同一套身份。`,
				result: "整合擴充網路，而不是製造新的資料孤島。",
			},
		],
		closing: {
			title: "想看每一項能力如何配合？",
			body: "能力參考從作品身份一路列到開放介面，並說明各自的價值、流程、關係與邊界。",
			action: "瀏覽完整能力",
		},
	},
	products: {
		eyebrow: "完整參考",
		title: "從作品身份到開放生態。",
		lead: "26 項能力按照它們在整體模型中的位置排列。這不是互不相干的功能清單，而是一條從辨認作品到延續共同知識的路徑。",
		searchLabel: "搜尋能力",
		searchPlaceholder: "輸入名稱或用途",
		allLayers: "全部",
		empty: "沒有符合條件的能力。",
		openProduct: "查看能力",
		layers: {
			identity: {
				title: "身份與關係",
				body: `辨認作品，連接版本、系列、${zhHantTerminology.entity.forms.label}與分類。`,
			},
			form: { title: "內容形態", body: "承載閱讀、觀看、創作、評論與回應。" },
			structure: { title: "結構與記憶", body: "組合內容，保留發佈、差異與演進脈絡。" },
			community: {
				title: "個人與社群",
				body: `收藏、策展、討論、${zhHantTerminology.follow.forms.actionLabel}並返回。`,
			},
			open: { title: "開放生態", body: "以清楚權限連接工具、服務與新的入口。" },
		},
	},
	product: {
		breadcrumbHome: "首頁",
		breadcrumbProducts: "能力參考",
		layerLabel: "所屬層次",
		related: "相關能力",
		readNext: "繼續理解",
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
