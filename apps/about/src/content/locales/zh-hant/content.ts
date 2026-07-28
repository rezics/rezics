import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { ProductId } from "../../productRegistry";
import type { ProductFamilyId, ProductPageCopy } from "../../productTypes";

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
const mcp = verbatimTerms.mcp.value;
const contentStructure = verbatimTerms.contentStructure.value;
const gameContentStructure = verbatimTerms.gameContentStructure.value;
const creditAttribution = verbatimTerms.creditAttribution.value;
const subjectAssociation = verbatimTerms.subjectAssociation.value;
const post = zhHantTerminology.post.forms.label;
const realm = zhHantTerminology.realm.forms.label;
const zone = zhHantTerminology.zone.forms.label;
const follow = zhHantTerminology.follow.forms.actionLabel;

const productNames = {
	catalog: "作品目錄",
	book: "書籍",
	gamebook: "遊戲書",
	media: "媒體",
	software: "軟體",
	series: "系列",
	release: "發行",
	post,
	wiki: "維基",
	picture: "圖片",
	review: "評論",
	collection: "收藏",
	library: "書庫",
	realm,
	zone,
	comment: "留言",
	score: "評分",
	"content-structure": "內容結構",
	history: "歷史",
	editor: "編輯器",
	feed: "動態",
	tag: "標籤",
	progress: "進度",
	entity: "實體",
	"api-oauth": `${api} 與 ${oauth}`,
	token: `${api} 權杖`,
} as const satisfies Record<ProductId, string>;

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

const productPages = {
	catalog: {
		summary: "把同一部作品的身分、版本與跨媒體關係放回同一張清楚的地圖。",
		introduction:
			"作品目錄不是一串互不相干的搜尋結果。它先確認「這是哪一部作品」，再把書籍、媒體、軟體、系列與發行連到正確的位置。",
		uses: [
			"辨認同一作品在不同語言、地區與媒介中的版本。",
			"從作品出發查看系列、發行、人物與主題關係。",
			"讓收藏、評論與內容連回穩定的作品身分。",
		],
		operation: [
			"先建立或辨認作品的穩定身分。",
			"再加入媒介、版本、發行與系列關係。",
			"最後讓其他產品引用同一份作品事實。",
		],
		boundary: "作品目錄負責辨認與連結作品，不取代書籍閱讀、內容創作、收藏或社群空間。",
	},
	book: {
		summary: "把一本書的作品身分、版本、目錄、內容與貢獻關係放在同一個產品表面。",
		introduction:
			"書籍先是一個可辨認的作品，再有版本、章節目錄、作者與譯者等關係。它不把每個版本拆成彼此無關的項目。",
		uses: [
			"查看一本書的主要版本、變體與發行資訊。",
			"由內容結構產生清楚的章節目錄。",
			"連結作者、譯者、出版商、角色與相關創作。",
		],
		operation: [
			"確認書籍的整體身分與版本關係。",
			"安排內容出現位置，形成可閱讀的目錄。",
			"發布後，把欄位與結構變更交給歷史記錄。",
		],
		boundary: `章節內容仍由${post}與內容出現位置承載；遊戲書則是書籍使用遊戲內容結構形成的產品形態。`,
	},
	gamebook: {
		summary: "讓書籍擁有選擇、分支、匯合與結局，同時保留每次閱讀路徑。",
		introduction: `遊戲書是書籍使用 ${gameContentStructure} 形成的分支閱讀形態。作者安排段落與選項，讀者的每一步則成為可解釋的旅程。`,
		uses: [
			"設計從入口到多個結局的閱讀路徑。",
			"讓選項分支後再次匯合，而不複製相同內容。",
			"保存讀者走過的旅程，讓下次回來仍知道發生過什麼。",
		],
		operation: [
			"先建立書籍，再啟用遊戲內容結構。",
			"設定入口、段落、選項、匯合與結局。",
			"發布前確認路徑沒有無法離開的循環。",
		],
		boundary: "目前聚焦分支閱讀，不包含變數、腳本、戰鬥系統或視覺小說執行環境。",
	},
	media: {
		summary: "為影像、聲音與其他媒體作品保留穩定身分，再連接系列與發行。",
		introduction:
			"媒體產品描述作品本身，而不是某次播放或某個檔案。不同剪輯、地區版本與載體可以在同一作品下被理解。",
		uses: [
			"整理影像、聲音與複合媒體作品的基本身分。",
			"連結系列、發行版本、人物與主題。",
			"讓評論、收藏與內容引用同一部媒體作品。",
		],
		operation: [
			"先辨認作品，再記錄媒體類型。",
			"加入系列、發行與版本差異。",
			"讓其他產品透過穩定身分建立關係。",
		],
		boundary: "媒體產品不負責串流播放、檔案託管或數位版權管理。",
	},
	software: {
		summary: "把軟體視為可持續辨認的作品，而不只是一個下載檔或版本號。",
		introduction: `軟體可以有平台、版本、發行與系列關係。${rezics} 保存這些關係，讓內容、收藏與評論不會只依賴一次性的商店頁面。`,
		uses: [
			"辨認遊戲、應用程式與其他軟體作品。",
			"整理平台、版本、發行與系列關係。",
			"連結開發者、發行者、評論與相關內容。",
		],
		operation: [
			"建立軟體作品的穩定身分。",
			"加入平台與具體發行版本。",
			"讓收藏與內容連回同一作品。",
		],
		boundary: "軟體產品不取代套件登錄檔、下載服務、更新系統或授權驗證。",
	},
	series: {
		summary: "表達作品之間有順序、有脈絡的系列關係，而不是臨時湊出的清單。",
		introduction:
			"系列可以連結多部作品、季度、卷冊或世代，並說明它們的順序與關係。系列本身不會吞掉每一部作品的獨立身分。",
		uses: [
			"整理故事、書籍、媒體或軟體的系列關係。",
			"表達正式順序、支線與衍生系列。",
			"讓讀者從一部作品找到前後作品。",
		],
		operation: [
			"先建立系列的身分與範圍。",
			"加入作品並標明順序或關係。",
			"持續保留每部作品自己的版本與內容。",
		],
		boundary: "系列不是個人收藏，也不等同於某次發行或一組搜尋標籤。",
	},
	release: {
		summary: "記錄作品在特定版本、地區、平台或時間點真正被發行的形態。",
		introduction:
			"作品告訴我們「它是什麼」，發行則回答「哪一個版本在何時、何地，以什麼形式出現」。",
		uses: [
			"區分不同地區、語言、平台與媒介的發行。",
			"記錄日期、發行者與版本差異。",
			"讓收藏與評論精確指向正確版本。",
		],
		operation: [
			"先連結所屬作品。",
			"加入地區、平台、格式與時間資訊。",
			"把內容與收藏指向需要的發行版本。",
		],
		boundary: "發行不是另一部獨立作品，也不負責銷售、庫存或數位配送。",
	},
	entity: {
		summary: "把人物、組織、角色與概念當作可重複引用的實體，清楚表達貢獻與主題關係。",
		introduction: `實體讓作者、譯者、出版商、角色與主題不再只是文字。${creditAttribution} 表達誰做了什麼，${subjectAssociation} 表達內容在談誰或什麼。`,
		uses: [
			"建立人物、組織、角色與概念的穩定身分。",
			"表達作者、譯者、出版商等貢獻關係。",
			"連結主角、主題、衍生創作與相關內容。",
		],
		operation: [
			"先辨認或建立實體。",
			"依關係用途選擇貢獻歸屬或主題關聯。",
			`讓書籍、${post}與作品共用同一份關係。`,
		],
		boundary: "實體不取代使用者帳號，也不把貢獻者與內容主題混成同一種關係。",
	},
	tag: {
		summary: `用輕量標籤整理內容與作品，同時保留真正的身分、系列與${realm}關係。`,
		introduction:
			"標籤適合表達可交叉使用的分類與語彙，但不應取代更精確的作品、人物、系列或空間結構。",
		uses: [
			`為作品、${post}、收藏與${zone}加入可搜尋的分類。`,
			"建立跨產品的主題入口。",
			"在不改變內容歸屬的前提下重新整理內容。",
		],
		operation: [
			"選擇既有標籤或建立新的語彙。",
			"把標籤加入需要被交叉整理的項目。",
			"從標籤聚合結果回到原本產品。",
		],
		boundary: "標籤不是資料夾、父子關係、權限邊界或作品身分。",
	},
	post: {
		summary: `以${post}承載可發布、可引用、可形成不同內容形態的基本內容。`,
		introduction: `${post}是 ${rezics} 的內容表面之一。它可以成為文章、維基、圖片或評論，但每種形態仍保有自己的使用方式與邊界。`,
		uses: [
			"撰寫文章、筆記、說明與其他可發布內容。",
			"用區塊組織文字、媒體與結構化內容。",
			"把內容連到作品、實體、標籤與社群空間。",
		],
		operation: [
			`選擇${post}形態與發布位置。`,
			"在編輯器中建立內容並補上關係。",
			"發布後由歷史記錄正式版本。",
		],
		boundary: `${post}不等同於作品目錄項目，也不取代留言、收藏或社群空間。`,
	},
	wiki: {
		summary: `用可持續修訂的${post}形態整理共同知識，保留來源、關係與發布歷史。`,
		introduction: `維基適合整理需要持續補充的知識。它建立在${post}上，但更重視可查證、可連結與長期維護。`,
		uses: [
			"建立作品、人物、世界觀與主題的參考頁。",
			"把多個來源與相關項目連到同一頁。",
			"透過發布歷史理解內容如何改變。",
		],
		operation: [
			"先確認頁面主題與對應實體。",
			"在編輯器中整理段落、來源與連結。",
			"發布後持續透過新版本修訂。",
		],
		boundary: "維基不是即時協作白板，也不應把未確認的草稿當成正式歷史。",
	},
	picture: {
		summary: "讓圖片、說明、來源與相關作品一起被發布，而不是只留下失去脈絡的檔案。",
		introduction: `圖片是以影像為主的${post}形態。它保留說明、來源、貢獻者、主題與發布位置，讓影像可被理解與引用。`,
		uses: [
			"發布插圖、截圖、照片與其他視覺內容。",
			"加入替代文字、說明、來源與貢獻關係。",
			`連結作品、人物、主題、標籤與${zone}。`,
		],
		operation: [
			"上傳或選擇影像內容。",
			"補上可及性文字、來源與關係。",
			"選擇發布空間並建立正式版本。",
		],
		boundary: "圖片不等同於作品目錄中的媒體作品，也不取代原始資產管理。",
	},
	review: {
		summary: "把完整評論、評分與被評論對象連在一起，保留可閱讀的判斷脈絡。",
		introduction: `評論是${post}的一種形態。分數可以幫助比較，但真正的評論仍是能說明觀點、證據與經驗的內容。`,
		uses: [
			"評論作品、版本、發行或其他可辨認項目。",
			"結合文字判斷與結構化評分。",
			"讓留言與後續討論留在評論脈絡中。",
		],
		operation: [
			"先選擇被評論的對象與版本。",
			"寫下觀點並視需要加入評分。",
			"發布後讓動態與留言承接討論。",
		],
		boundary: "評分不是評論本身；評論也不會改寫被評論作品的事實資料。",
	},
	comment: {
		summary: "讓回應留在它所討論的內容旁邊，並保有可追溯的發布脈絡。",
		introduction: `留言適合短而直接的討論。它依附於${post}、評論或其他可討論表面，不需要被包裝成新的長篇內容。`,
		uses: [
			`回應${post}、評論與社群中的具體內容。`,
			"延續討論並保留上下文。",
			"讓重要回應出現在相關動態中。",
		],
		operation: [
			"在可討論的內容下建立回應。",
			"保留回覆對象與討論串關係。",
			"發布與後續變更遵循對應歷史規則。",
		],
		boundary: `留言不是${post}編輯器，也不應取代正式修訂、評分或作品資料。`,
	},
	score: {
		summary: "用結構化尺度表達評價，並始終連回被評分對象與完整評論。",
		introduction: "評分提供快速比較，但不脫離脈絡。它可以獨立存在，也可以成為評論的一部分。",
		uses: [
			"對作品、版本或發行給出一致尺度的評價。",
			"把分數與評論文字放在同一脈絡。",
			"彙整社群評價時保留來源。",
		],
		operation: [
			"先選擇被評分對象與尺度。",
			"記錄分數及必要說明。",
			"在評論、目錄或動態中呈現結果。",
		],
		boundary: "評分不代替評論內容，也不把聚合數字當成無來源的作品事實。",
	},
	"content-structure": {
		summary: "管理內容的出現位置、順序與重複使用，也為分支閱讀提供可驗證的結構。",
		introduction: `內容結構以 ${contentStructure} 管理有序內容；需要分支時，再由 ${gameContentStructure} 加入入口、選項、匯合與結局。`,
		uses: [
			`為書籍、${post}與其他載體安排可閱讀的順序。`,
			"讓同一份內容在不同位置重複出現而不複製。",
			"建立並驗證遊戲書的分支閱讀路徑。",
		],
		operation: [
			`建立內容出現位置，而不是複製${post}本身。`,
			"在樹狀或遊戲模式中安排順序與關係。",
			"由實際產品把結構轉成目錄或閱讀體驗。",
		],
		boundary: `內容結構不是編輯器、${post}或遊戲書的父產品，也不負責發布歷史。`,
	},
	editor: {
		summary: "為不同產品提供一致的內容編輯體驗，同時尊重各產品自己的結構與發布規則。",
		introduction: `編輯器負責讓人建立與修改內容。它可以服務書籍、${post}與內容結構，但不擁有這些產品的身分與資料模型。`,
		uses: [
			"編輯文字、媒體與結構化內容區塊。",
			"依產品需要顯示正確欄位與工具。",
			"在發布前完成驗證與預覽。",
		],
		operation: [
			"由產品開啟符合其內容模型的編輯介面。",
			"在草稿中修改並即時驗證。",
			"發布時把正式版本交給產品與歷史。",
		],
		boundary: "編輯器不等同於內容模型，也不把每次草稿操作寫成正式歷史。",
	},
	collection: {
		summary: "以明確意圖把作品與內容放在一起，形成可命名、可排序、可分享的收藏。",
		introduction:
			"收藏比標籤更有組織意圖，也比系列更個人。它可以是稍後閱讀、主題選集或長期策展。",
		uses: [
			"建立稍後閱讀、最愛或主題選集。",
			"手動排序並補上收藏說明。",
			"把作品、內容與其他可收藏項目放在一起。",
		],
		operation: [
			"先建立收藏名稱與目的。",
			"加入項目並調整順序。",
			"依需要維持私人、分享或公開狀態。",
		],
		boundary: "收藏不是作品系列、標籤結果或檔案資料夾。",
	},
	library: {
		summary: "以收藏為基礎，形成專注書籍、閱讀狀態與進度的個人書庫。",
		introduction:
			"書庫是收藏的一種產品形態。它不只列出書籍，也把想讀、閱讀中、已讀與進度放進同一個長期空間。",
		uses: [
			"整理想讀、閱讀中與已讀書籍。",
			"從書籍或版本接續上次閱讀位置。",
			"建立個人的閱讀書架與主題分組。",
		],
		operation: [
			"從既有收藏建立書庫。",
			"加入書籍並設定閱讀狀態。",
			"由進度能力更新可接續的位置。",
		],
		boundary: "書庫不取代作品目錄，也不應把個人狀態寫回公共作品事實。",
	},
	realm: {
		summary: `為長期共同喜愛的故事與主題建立一個可治理、可延伸的社群${realm}。`,
		introduction: `${realm}提供較大的共同空間，容納${zone}、內容、成員與治理方式。它讓社群關係不必依附單一${post}。`,
		uses: [
			"圍繞作品、創作類型或共同興趣建立社群。",
			`組織多個${zone}與長期內容脈絡。`,
			"設定成員角色、可見性與治理方式。",
		],
		operation: [
			`先定義${realm}的主題與治理範圍。`,
			`建立${zone}並安排內容入口。`,
			`由動態聚合${realm}內值得跟進的變化。`,
		],
		boundary: `${realm}不是作品分類或收藏；它是一個有成員與治理脈絡的社群空間。`,
	},
	zone: {
		summary: `在${realm}中建立聚焦的內容${zone}，讓特定主題、活動或工作流有自己的入口。`,
		introduction: `${zone}比${realm}更聚焦。它可以承接討論、策展、活動或特定內容格式，同時保留與${realm}的關係。`,
		uses: [
			"為主題、活動或創作計畫建立清楚入口。",
			`安排${zone}內容與顯示方式。`,
			`把重要更新送進${realm}與個人動態。`,
		],
		operation: [
			`在適合的${realm}中建立${zone}。`,
			"設定範圍、內容結構與可見性。",
			"發布內容並透過歷史保留正式變更。",
		],
		boundary: `${zone}不等同於標籤、收藏或單一${post}，也不應脫離${realm}治理。`,
	},
	feed: {
		summary: "把使用者真正關心的作品、內容與社群更新組成可理解的動態。",
		introduction: `動態不是無差別的時間線。它從${follow}、${realm}、${zone}與內容關係取得更新，並讓每一則項目回到真正的來源。`,
		uses: [
			`跟進${realm}、${zone}、作品與創作者的更新。`,
			`聚合新${post}、留言與重要變更。`,
			"從動態直接回到原始內容與脈絡。",
		],
		operation: [
			`根據使用者的${follow}與關係建立查詢。`,
			"把更新轉成有來源的動態項目。",
			"保留篩選與後續回到原產品的路徑。",
		],
		boundary: "動態不擁有內容，也不把推薦結果當成作品或社群的正式結構。",
	},
	progress: {
		summary: "保存閱讀、遊玩與觀看的個人狀態，讓下一次回來可以從真正的位置繼續。",
		introduction:
			"進度屬於使用者，不改寫公共作品資料。它可以記錄狀態、比例、時間與最後內容位置。",
		uses: [
			"記錄想開始、進行中、完成或暫停。",
			"保存最後閱讀章節或遊戲書路徑摘要。",
			"在書庫與其他個人空間中接續內容。",
		],
		operation: [
			"由產品回報可辨認的內容位置。",
			"更新使用者自己的狀態與進度。",
			"下次進入產品時還原可接續入口。",
		],
		boundary: "進度不是完整旅程歷史，也不會改變作品、發行或內容的公共事實。",
	},
	history: {
		summary: "以欄位或區塊為範圍記錄已發布版本、差異與鎖定狀態。",
		introduction:
			"歷史關心正式發布後發生了什麼。不同產品可以選擇適合自己的欄位或區塊範圍，而不必被迫使用同一種整體快照。",
		uses: [
			`查看書籍欄位、${post}區塊或${zone}設定的版本。`,
			"比較已發布版本之間的具體差異。",
			"確認鎖定狀態與作用範圍。",
		],
		operation: [
			"由產品指定需要被記錄的歷史範圍。",
			"只在發布邊界建立正式版本。",
			"把版本、差異與鎖定資訊帶回原產品。",
		],
		boundary: "歷史不隸屬於編輯器，也不把草稿操作、自動合併或任意恢復當成已實作能力。",
	},
	"api-oauth": {
		summary: `透過權限明確的 ${api}、${oauth} 與 ${mcp}，讓外部工具安全連接 ${rezics}。`,
		introduction:
			"開放連接不是把所有資料交出去。每個外部應用都應清楚知道自己可以讀什麼、寫什麼，以及代表誰執行。",
		uses: [
			"讓外部應用讀取或操作經授權的產品能力。",
			`讓使用者透過 ${oauth} 授權應用，而不交出密碼。`,
			`讓支援 ${mcp} 的工具在可審查的範圍內工作。`,
		],
		operation: [
			"應用先宣告需要的權限與回呼資訊。",
			"使用者理解範圍後完成授權。",
			"每次請求都依權限與產品邊界驗證。",
		],
		boundary: `${api} 與 ${oauth} 不會繞過產品權限，也不把內部協議自動變成公開承諾。`,
	},
	token: {
		summary: `為工具與自動化提供可撤銷、可限縮、可稽核的 ${api} 存取憑證。`,
		introduction:
			"權杖適合指令列工具、個人自動化與受控代理程式。每一把權杖都有自己的能力範圍，不必沿用帳號的全部權限。",
		uses: [
			"為個人腳本或開發工具建立專用憑證。",
			"限制可用產品、操作與資料範圍。",
			"在不再需要時立即撤銷權杖。",
		],
		operation: [
			"先選擇用途與最小必要權限。",
			"建立後只顯示一次完整權杖。",
			"持續查看使用情況並在需要時撤銷。",
		],
		boundary: "權杖不是密碼替代品，也不應出現在公開程式碼、紀錄或由代理程式代填的環境檔案中。",
	},
} as const satisfies Record<ProductId, ProductPageCopy>;

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
			names: productNames,
			labels: {
				overview: "它是什麼",
				uses: "你可以用它做什麼",
				operation: "它如何運作",
				boundary: "它不負責什麼",
				related: "接著可以認識",
				parent: "建立在這項產品上",
				demo: "直接試試看",
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
		byId: productPages,
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
