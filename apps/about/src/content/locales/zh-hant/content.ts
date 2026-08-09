import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";
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
const FOLLOW = zhHantTerminology.follow.forms.actionLabel;
const REALM = zhHantTerminology.realm.forms.label;

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
			description: `跨平台、跨語言找到網路小說，${FOLLOW}連載，並在${REALM}遇見同好。`,
		},
		how: {
			title: `運作原理 — ${BRAND}`,
			description: `理解 ${BRAND} 如何以共享作品身份連接跨平台來源，再以語言、${REALM}、標籤投票與個人作用域保存不同脈絡。`,
		},
		uses: {
			title: `用途 — ${BRAND}`,
			description: `探索讀者如何跨平台尋書、${FOLLOW}連載、保存進度並找到同好。`,
		},
		products: {
			title: `能力地圖 — ${BRAND}`,
			description: `分辨 ${BRAND} 已可使用、開發中與規劃中的作品、內容、社群及開放能力。`,
		},
	},
	home: {
		eyebrow: "傳承 · 創作 · 傳播",
		title: "與所愛的故事相遇。",
		lead: `從散落在不同平台與語言中的網路小說開始。${BRAND} 將原名、譯名、連載來源、章節與社群重新連成同一部持續演進的作品。`,
		explore: "探索網路小說",
		understand: `理解 ${BRAND}`,
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
			body: `${BRAND} 以開放原始碼、帶版本語義的內容文件、${zhHantTerminology.publicationLicense.forms.label}與權限化 ${API} 建立長期可延伸的邊界；能力地圖則明確區分已可使用、開發中與規劃中的部分。`,
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
			focus: {
				label: "第一版現在開始",
				items: [
					"啟動計畫｜首批 40 萬冊",
					"跨平台來源",
					"跨語言作品身份",
					`${REALM}同好社群`,
				],
			},
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
	how: {
		eyebrow: "作品網路如何形成",
		title: "同一部作品，可以跨平台、跨語言，也可以在不同社群裡被重新理解。",
		lead: `${BRAND} 先讓作品、來源與關係指向共享身份，再把語言呈現、${REALM}脈絡、標籤投票與個人偏好放回各自的作用域。共享的部分不必複製，應保留差異的部分也不會被壓成全站唯一答案。`,
		stages: [
			{
				title: "1. 跨平台作品身份",
				body: "原始連載、翻譯來源、授權平台與出版版本保持差異，卻能回到同一個可治理的作品網路。",
			},
			{
				title: "2. 共享模型與語言呈現",
				body: "作品、書單、順序與關係超越語言；名稱、摘要與內容則依讀者語言呈現。",
			},
			{
				title: `3. ${REALM}作用域`,
				body: `同一單元可以進入多個${REALM}；每個社群管理自己的發布關係、規則與策展，卻不取得原始內容所有權。`,
			},
			{
				title: "4. 標籤＋投票",
				body: `全域判斷、${REALM}判斷、政策標籤與個人整理各自保留，分類不必冒充唯一真相。`,
			},
			{
				title: `5. ${BLOCK_SCHEMA} 與 ${PORTABLE_TEXT}`,
				body: "文件、內容、出現位置、順序與發布歷史各有邊界，讓長篇連載與共同知識可以持續演進。",
			},
			{
				title: "6. 從發現回到共同建造",
				body: "尋找、閱讀、加入社群與補充知識形成循環，讓每次參與都降低下一位讀者的尋找成本。",
			},
		],
		integrity: {
			title: "共享身份，不代表抹平所有差異。",
			body: `作品與來源需要共同基礎；${REALM}需要自己的治理與投票脈絡；個人進度與整理則只屬於本人。${BRAND} 的核心不是把所有資料集中成一個答案，而是讓每一種答案停留在正確的作用域，仍能透過同一個作品網路彼此連結。`,
		},
		v1: {
			scope: {
				title: "先分清楚，什麼必須共享，什麼應該保留差異。",
				body: `同一部作品可以跨越平台、語言與社群，但不同層次擁有不同權力。這組邊界決定資料能否重用，也決定${REALM}與個人是否保有真正的自主性。`,
				layers: [
					{
						title: "共享層",
						body: "跨平台、跨語言仍指向同一組可追溯的作品基礎。",
						items: [
							"作品、人物、系列與標籤的穩定身份",
							"平台來源、版本、系列與其他明確關係",
							"各語言名稱、摘要及可重用的內容結構",
						],
					},
					{
						title: `${REALM}作用域`,
						body: "社群針對共享對象建立自己的發布關係、治理與分類觀點。",
						items: [
							`單元進入${REALM}的發布與停靠關係`,
							"規則、內容治理、維基、導覽與策展",
							`${REALM}標籤語境、投票與排序`,
						],
					},
					{
						title: "個人層",
						body: "只改變自己的閱讀與整理方式，不冒充公共事實。",
						items: [
							"介面語言與內容語言偏好",
							`閱讀進度、收藏與${FOLLOW}狀態`,
							"個人標籤與只屬於自己的判斷",
						],
					},
				],
			},
			mechanisms: {
				title: "五個互相咬合的核心機制",
				body: "每一項都解決不同問題；只有把它們放在一起，跨語言發現、社群策展與共同治理才會形成長期累積。",
				exampleLabel: "具體情境",
				ruleLabel: "不變的邊界",
				capabilityLabel: "對照能力與目前狀態",
				items: [
					{
						title: "一部作品，不再被平台切碎",
						body: `網路小說可能同時存在於原始連載、翻譯與授權平台、出版版本及其他來源。${BRAND} 不把任何一家平台當成作品邊界，而是讓入口保持來源證據，再連回穩定身份。`,
						points: [
							`穩定 ${verbatimTerms.id.value} 不依賴單一網址、書名或語言`,
							"主條目／變體關係保留版本差異，不假裝所有條目完全相同",
							"來源說明作品在哪裡出現，不取代身份或所有權證明",
						],
						example: {
							title: "一部連載，從三個入口被找到",
							body: "讀者可以從原始連載、中文翻譯來源或出版版本進入；每個入口保留自己的資訊，同時回到同一部作品的來源、版本與社群脈絡。",
						},
						rule: "平台網址是來源，不是作品唯一身份；作品被引用或發布，也不等於所有權發生轉移。",
					},
					{
						title: "共享模型，語言各自呈現",
						body: "作品身份、書單成員、策展順序與關係不綁定某一種語言；原名、譯名、摘要與內容則依語言分開維護。介面語言和內容語言偏好也各自決定不同事情。",
						points: [
							"模型保存作品、關係、分組與順序",
							"本地化保存名稱、摘要與適合該語言的內容",
							"介面語言控制操作文字，內容偏好控制呈現及回退順序",
						],
						example: {
							title: "日文書單，對中文讀者仍然有價值",
							body: "建立者策展的是作品身份與順序。中文讀者開啟同一份書單時，可以看到已有的中文名稱與摘要；缺少本地化時才回退到其他語言，不會失去作品、順序或來源。",
						},
						rule: "新增中文本地化是在補全同一份共享模型，不必另外複製一份中文版書單。",
					},
					{
						title: `${REALM}作用域：共享基礎上的不同社群脈絡`,
						body: `同一個作品或其他單元可以進入多個${REALM}。每個${REALM}擁有自己的成員、規則、內容動態、維基、導覽、策展與治理脈絡，但共享對象不會因此被複製或改換所有者。`,
						points: [
							`同一單元可以同時發布到多個${REALM}`,
							`每個${REALM}分別管理關係狀態、規則與呈現`,
							`移除${REALM}中的關係，不會刪除原始作品或${zhHantTerminology.post.forms.label}`,
						],
						example: {
							title: "同一部作品，可以被不同社群用不同方式理解",
							body: `翻譯研究${REALM}可以整理譯名與來源；類型讀者${REALM}可以建立題材策展與討論規則。兩邊引用同一作品，卻不必共用同一套社群判斷。`,
						},
						rule: `${REALM}治理的是發布關係與社群脈絡，不會因內容出現在其中就取得原始內容所有權。`,
					},
					{
						title: "標籤＋投票：分類是一種有作用域的判斷",
						body: `標籤本身是可本地化、可跨產品重用的身份；某個標籤是否適用，則可以由全域社群、特定${REALM}、治理者或個人分別表達。這讓分類能形成共識，也容得下脈絡差異。`,
						points: [
							"全域社群投票：累積整個平台的判斷",
							`${REALM}語境投票：只在該社群的規則與排序中生效`,
							`${REALM}政策標籤：由治理者直接維護`,
							"個人標籤：只服務自己的整理方式",
						],
						example: {
							title: "「異世界」可以是共享語彙，也可以有社群判斷",
							body: `標籤名稱與多語言說明可以共享；某部作品是否適用這個標籤，則能分別呈現全域與${REALM}投票結果。個人也能使用自己的標籤，而不把它宣稱為公共事實。`,
						},
						rule: `全域投票不得和${REALM}投票合併；治理者的置頂或政策判斷也不會被計算成社群贊成票。`,
					},
					{
						title: `${BLOCK_SCHEMA}＋${PORTABLE_TEXT}：內容可以持續演進`,
						body: `${BRAND} 將文件內容、內容出現的位置、章節順序與發布歷史分開建模。${PORTABLE_TEXT} 編輯器直接產生結構化富文字；${BLOCK_SCHEMA} 為區塊提供類型、穩定鍵值、版本與驗證邊界。`,
						points: [
							`${BLOCK_SCHEMA} 使用封閉的區塊類型，不讓未知內容默默通過`,
							`${PORTABLE_TEXT} 編輯器產生可驗證、可引用的結構化內容`,
							"內容結構安排出現位置與順序，歷史保存已發布修訂",
						],
						example: {
							title: "正文是一份內容，章節位置是另一份關係",
							body: "同一篇章節可以被內容結構安排到正確位置，必要時也能重用；調整目錄順序不必複製正文，發布與還原則以明確修訂保留歷史。",
						},
						rule: "編輯器產生並驗證文件；內容單元擁有正文；內容結構安排出現位置；發布歷史保存可追溯修訂。",
					},
				],
			},
			loop: {
				title: "這些機制最後回到同一個循環",
				body: "首批 40 萬冊建立可進入的起點；真正持續增長的，是作品身份、跨語言關係、社群脈絡與共同判斷之間的連結。",
				steps: [
					{ title: "跨平台、跨語言發現", body: "從熟悉的名稱或來源找到同一部作品。" },
					{ title: `閱讀、收藏與${FOLLOW}`, body: "保存自己的進度與長期興趣。" },
					{ title: `加入或建立${REALM}`, body: "進入適合的社群脈絡與治理規則。" },
					{ title: "補充來源、內容與判斷", body: "貢獻本地化、關係、標籤與投票。" },
					{ title: "讓下一次發現更準確", body: "共同知識回到搜尋、策展與推薦。" },
				],
				closing:
					"不是任何一項功能單獨形成護城河，而是每次發現都可能帶來新的脈絡，每次貢獻又讓下一次發現更好。",
				capabilitiesAction: "查看完整能力地圖",
				usesAction: "探索實際用途",
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
				body: `開發者目前可透過 ${API} 與權杖存取明確範圍；${OAUTH} 與 ${MCP} 整合則依能力地圖所標示的階段逐步開放。`,
				result: "公開現在能用什麼，也公開下一步要往哪裡走。",
			},
		],
		closing: {
			title: "想分清楚現在、正在建造與長期方向？",
			body: "能力地圖為每一項能力標示階段，再用完整文件說明它和作品網路的關係。",
			action: "瀏覽能力地圖",
		},
	},
	products: {
		eyebrow: "能力地圖",
		title: "從網路小說開始，看見整個作品網路。",
		lead: "這裡同時記錄已可使用的能力、正在建造的系統與已公開的設計方向。狀態標記說明現在；完整文件說明它們將如何合作。",
		searchLabel: "搜尋能力",
		searchPlaceholder: "搜尋名稱、用途或狀態",
		allLayers: "全部",
		empty: "沒有符合條件的能力。",
		openProduct: "查看能力",
		stage: {
			legend: "能力狀態",
			current: "目前狀態",
			labels: { available: "已可使用", development: "開發中", planned: "規劃中" },
		},
		layers: {
			identity: {
				title: "作品身份",
				body: `辨認同一部作品，連接來源、版本、系列、${zhHantTerminology.entity.forms.label}與分類。`,
			},
			form: { title: "閱讀與內容", body: "承載網路小說、文章、媒體、評論與回應。" },
			structure: {
				title: "結構與歷史",
				body: "組合內容，保存區塊身份、發布修訂與演進脈絡。",
			},
			community: {
				title: "社群與探索",
				body: `收藏、${FOLLOW}、保存進度、加入${zhHantTerminology.realm.forms.label}並讓發現持續循環。`,
			},
			open: { title: "開放介面", body: `以清楚權限連接工具、服務、${AI} 與新的作品入口。` },
		},
	},
	product: {
		breadcrumbHome: "首頁",
		breadcrumbProducts: "能力地圖",
		layerLabel: "所屬層次",
		related: "相關能力",
		readNext: "沿著關係繼續理解",
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
