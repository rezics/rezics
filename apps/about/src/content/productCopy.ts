import type { AboutLocale } from "../i18n/locales";
import { PRODUCT_DEFINITIONS, type ProductId } from "./productRegistry";
import type { LocalizedProductCopy } from "./productTypes";

const SUMMARY_BY_LOCALE = {
	"zh-hant": {
		catalog: "統一承載 Book、Media、Software、Series 與 Release 身份的作品目錄。",
		book: "把一本書的身份、版本、目錄、內容與歸屬關係放在同一個產品表面。",
		gamebook: "由 Book 使用 GameContentStructure 形成的分支閱讀產品形態。",
		media: "為影像、音訊與其他媒體作品保留穩定身份與發行資訊。",
		software: "描述軟體作品、版本與相關實體的目錄產品。",
		series: "連接系列身份、組成作品與發行關係。",
		release: "表達作品在特定版本、語言、載體或市場中的一次發行。",
		post: "承載可編輯、可追溯並可進入 Feed 的內容單元。",
		wiki: "以 Post(kind=WIKI) 形成的知識型內容表面。",
		picture: "以 Post(kind=PICTURE) 承載一張或多張有序圖片。",
		review: "以 Post(kind=REVIEW) 形成的評論內容，並可連接 Score。",
		shelf: "可巢狀整理內容與目錄項目的通用收藏表面。",
		library: "由 Shelf(mode=LIBRARY) 形成的個人收藏產品形態。",
		realm: "為一個社群或主題提供共享語境，而不直接擁有被連結內容。",
		zone: "以查詢、配置與區塊協議組合出的社群空間。",
		comment: "附著於內容與討論脈絡的回應產品。",
		score: "可被評論與目錄表面引用的結構化評分。",
		"content-structure": "在多個載體中管理內容出現位置、順序、復用與可選遊戲結構。",
		history: "以欄位或區塊為範圍記錄已發佈版本、差異與鎖定狀態。",
		editor: "讓不同內容類型共享一致但可擴充的編輯工作流。",
		feed: "把多種產品的更新組合成可辨識、可切換的內容流。",
		tags: "為產品提供共享、可查詢的標記基礎設施。",
		progress: "保存一般閱讀或使用進度；GameBook Journey 仍由自己的模型負責。",
		"entity-attribution":
			"以 Entity、CreditAttribution 與 SubjectAttribution 表達真實與虛構對象的歸屬關係。",
		"api-oauth": "透過權限化 API、OAuth 與 MCP 讓 Rezics 能力對外連接。",
	},
	"zh-hans": {
		catalog: "统一承载 Book、Media、Software、Series 与 Release 身份的作品目录。",
		book: "把一本书的身份、版本、目录、内容与归属关系放在同一个产品表面。",
		gamebook: "由 Book 使用 GameContentStructure 形成的分支阅读产品形态。",
		media: "为影像、音频与其他媒体作品保留稳定身份和发行信息。",
		software: "描述软件作品、版本与相关实体的目录产品。",
		series: "连接系列身份、组成作品与发行关系。",
		release: "表达作品在特定版本、语言、载体或市场中的一次发行。",
		post: "承载可编辑、可追溯并可进入 Feed 的内容单元。",
		wiki: "由 Post(kind=WIKI) 形成的知识型内容表面。",
		picture: "由 Post(kind=PICTURE) 承载一张或多张有序图片。",
		review: "由 Post(kind=REVIEW) 形成的评论内容，并可连接 Score。",
		shelf: "可嵌套整理内容与目录项目的通用收藏表面。",
		library: "由 Shelf(mode=LIBRARY) 形成的个人收藏产品形态。",
		realm: "为社区或主题提供共享语境，而不直接拥有被连接内容。",
		zone: "由查询、配置和区块协议组合出的社区空间。",
		comment: "附着于内容与讨论上下文的回应产品。",
		score: "可被评论与目录表面引用的结构化评分。",
		"content-structure": "在多个载体中管理内容位置、顺序、复用和可选游戏结构。",
		history: "以字段或区块为范围记录已发布版本、差异和锁定状态。",
		editor: "让不同内容类型共享一致但可扩展的编辑工作流。",
		feed: "把多种产品的更新组合成可辨识、可切换的内容流。",
		tags: "为产品提供共享、可查询的标签基础设施。",
		progress: "保存一般阅读或使用进度；GameBook Journey 仍由自身模型负责。",
		"entity-attribution":
			"用 Entity、CreditAttribution 和 SubjectAttribution 表达真实与虚构对象的归属关系。",
		"api-oauth": "通过权限化 API、OAuth 与 MCP 让 Rezics 能力对外连接。",
	},
	en: {
		catalog:
			"A catalog that gives Book, Media, Software, Series, and Release stable identities.",
		book: "One product surface for a book’s identity, variants, structure, content, and attribution.",
		gamebook: "A branching reading manifestation formed when Book uses GameContentStructure.",
		media: "Stable identity and release context for audiovisual and other media works.",
		software: "A catalog product for software works, releases, and related entities.",
		series: "Connects a series identity with its constituent works and releases.",
		release: "Represents a work released in a particular version, language, medium, or market.",
		post: "An editable, traceable content unit that can appear in feeds.",
		wiki: "A knowledge-oriented surface formed by Post(kind=WIKI).",
		picture: "A Post(kind=PICTURE) containing one or more ordered images.",
		review: "A review surface formed by Post(kind=REVIEW), optionally connected to Score.",
		shelf: "A general, nestable surface for organizing content and catalog entries.",
		library: "A personal collection manifestation formed by Shelf(mode=LIBRARY).",
		realm: "Shared context for a community or subject without owning linked content.",
		zone: "A community space composed from queries, configuration, and block protocols.",
		comment: "A response product attached to content and discussion context.",
		score: "Structured ratings that reviews and catalog surfaces can reference.",
		"content-structure":
			"Manages placement, order, reuse, and optional game structure across content carriers.",
		history: "Published-version history, diffs, and locks scoped to fields or blocks.",
		editor: "A consistent but extensible editing workflow shared by different content types.",
		feed: "Recognizable streams that combine updates from several product surfaces.",
		tags: "Shared, queryable tagging infrastructure for Rezics products.",
		progress: "General reading or usage progress; GameBook Journey remains a separate model.",
		"entity-attribution":
			"Real and fictional entities connected to Units through CreditAttribution and SubjectAttribution.",
		"api-oauth": "Permissioned API, OAuth, and MCP entry points for connecting Rezics.",
	},
	ja: {
		catalog: "Book、Media、Software、Series、Release に安定した識別子を与えるカタログです。",
		book: "書籍の同一性、版、構造、内容、帰属関係を一つの画面にまとめます。",
		gamebook: "Book が GameContentStructure を利用して形成される分岐読書形態です。",
		media: "映像・音声などの作品に安定した同一性とリリース情報を与えます。",
		software: "ソフトウェア作品、バージョン、関連 Entity のためのカタログです。",
		series: "シリーズと構成作品、リリースの関係を管理します。",
		release: "特定の版、言語、媒体、市場における作品のリリースを表します。",
		post: "編集可能で履歴を持ち、Feed に表示できるコンテンツ単位です。",
		wiki: "Post(kind=WIKI) から形成される知識コンテンツです。",
		picture: "Post(kind=PICTURE) に一枚以上の順序付き画像を保存します。",
		review: "Post(kind=REVIEW) から形成され、Score と接続できるレビューです。",
		shelf: "コンテンツを入れ子で整理できる汎用コレクションです。",
		library: "Shelf(mode=LIBRARY) から形成される個人ライブラリです。",
		realm: "リンク先を所有せず、コミュニティや主題の共有文脈を提供します。",
		zone: "クエリ、設定、ブロック規約から構成されるコミュニティ空間です。",
		comment: "コンテンツと会話の文脈に付く返信プロダクトです。",
		score: "レビューやカタログから参照できる構造化評価です。",
		"content-structure": "内容の配置、順序、再利用、任意のゲーム構造を管理します。",
		history: "公開版の差分とロックをフィールドまたはブロック単位で管理します。",
		editor: "異なる内容型で共有する拡張可能な編集ワークフローです。",
		feed: "複数のプロダクト更新を識別可能なストリームにまとめます。",
		tags: "複数プロダクトで使える検索可能なタグ基盤です。",
		progress: "一般的な読書・利用進捗を保存し、Journey は別モデルに保ちます。",
		"entity-attribution": "Entity と Unit の関係を二種類の Attribution で表します。",
		"api-oauth": "権限付き API、OAuth、MCP を通じて Rezics を外部接続します。",
	},
	de: {
		catalog:
			"Ein Katalog mit stabilen Identitäten für Book, Media, Software, Series und Release.",
		book: "Eine Oberfläche für Identität, Varianten, Struktur, Inhalt und Zuordnung eines Buches.",
		gamebook: "Eine verzweigte Leseform, wenn Book GameContentStructure verwendet.",
		media: "Stabile Identität und Veröffentlichungskontext für audiovisuelle Werke.",
		software: "Katalog für Softwarewerke, Versionen und zugehörige Entitäten.",
		series: "Verbindet eine Serienidentität mit Werken und Veröffentlichungen.",
		release: "Eine Veröffentlichung in bestimmter Version, Sprache, Form oder Markt.",
		post: "Eine bearbeitbare, nachvollziehbare Inhaltseinheit für Feeds.",
		wiki: "Eine Wissensoberfläche auf Basis von Post(kind=WIKI).",
		picture: "Post(kind=PICTURE) mit einem oder mehreren geordneten Bildern.",
		review: "Eine Rezension aus Post(kind=REVIEW), optional mit Score.",
		shelf: "Eine verschachtelbare Sammlung für Inhalte und Katalogeinträge.",
		library: "Eine persönliche Sammlung aus Shelf(mode=LIBRARY).",
		realm: "Gemeinsamer Kontext, ohne verlinkte Inhalte zu besitzen.",
		zone: "Community-Bereich aus Abfragen, Konfiguration und Blockprotokollen.",
		comment: "Antwortprodukt im Kontext von Inhalt und Diskussion.",
		score: "Strukturierte Bewertungen für Rezensionen und Kataloge.",
		"content-structure":
			"Verwaltet Position, Reihenfolge, Wiederverwendung und optionale Spielstruktur.",
		history: "Veröffentlichte Versionen, Unterschiede und Sperren auf Feld- oder Blockebene.",
		editor: "Gemeinsamer, erweiterbarer Bearbeitungsablauf für verschiedene Inhaltstypen.",
		feed: "Erkennbare Streams aus Aktualisierungen mehrerer Produkte.",
		tags: "Geteilte, abfragbare Schlagwort-Infrastruktur.",
		progress: "Allgemeiner Lese- oder Nutzungsfortschritt; Journey bleibt getrennt.",
		"entity-attribution":
			"Reale und fiktive Entitäten über zwei Attribution-Typen mit Units verbunden.",
		"api-oauth": "Berechtigte API-, OAuth- und MCP-Schnittstellen für Rezics.",
	},
	ko: {
		catalog:
			"Book, Media, Software, Series, Release에 안정적인 정체성을 제공하는 카탈로그입니다.",
		book: "책의 정체성, 판본, 구조, 콘텐츠, 귀속 관계를 하나의 제품 표면에 담습니다.",
		gamebook: "Book이 GameContentStructure를 사용할 때 만들어지는 분기 읽기 형태입니다.",
		media: "영상·음성 등 미디어 작품의 안정적인 정체성과 발행 맥락을 제공합니다.",
		software: "소프트웨어 작품, 버전, 관련 Entity를 위한 카탈로그입니다.",
		series: "시리즈 정체성과 구성 작품, 발행 관계를 연결합니다.",
		release: "특정 버전, 언어, 매체, 시장에서의 작품 발행을 나타냅니다.",
		post: "편집 가능하고 추적 가능하며 Feed에 나타날 수 있는 콘텐츠 단위입니다.",
		wiki: "Post(kind=WIKI)로 만들어지는 지식형 콘텐츠 표면입니다.",
		picture: "Post(kind=PICTURE)에 하나 이상의 순서 있는 이미지를 담습니다.",
		review: "Post(kind=REVIEW)로 만들어지며 Score와 연결할 수 있는 리뷰입니다.",
		shelf: "콘텐츠와 카탈로그 항목을 중첩해 정리하는 범용 컬렉션입니다.",
		library: "Shelf(mode=LIBRARY)로 만들어지는 개인 라이브러리입니다.",
		realm: "연결된 콘텐츠를 소유하지 않고 커뮤니티나 주제의 공통 맥락을 제공합니다.",
		zone: "쿼리, 설정, 블록 프로토콜로 구성되는 커뮤니티 공간입니다.",
		comment: "콘텐츠와 대화 맥락에 연결되는 응답 제품입니다.",
		score: "리뷰와 카탈로그 표면이 참조할 수 있는 구조화된 평점입니다.",
		"content-structure": "콘텐츠 위치, 순서, 재사용, 선택적 게임 구조를 관리합니다.",
		history: "공개 버전의 이력, 차이, 잠금을 필드 또는 블록 범위로 관리합니다.",
		editor: "여러 콘텐츠 유형이 공유하는 확장 가능한 편집 작업 흐름입니다.",
		feed: "여러 제품의 업데이트를 구분 가능한 스트림으로 구성합니다.",
		tags: "제품 전반에서 공유하고 조회할 수 있는 태그 기반입니다.",
		progress: "일반 읽기·사용 진척을 저장하며 GameBook Journey는 분리합니다.",
		"entity-attribution":
			"Entity와 Unit의 관계를 CreditAttribution과 SubjectAttribution으로 표현합니다.",
		"api-oauth": "권한 기반 API, OAuth, MCP로 Rezics를 외부와 연결합니다.",
	},
} as const satisfies Record<AboutLocale, Record<ProductId, string>>;

const DETAIL_LANGUAGE = {
	"zh-hant": {
		scenario: (name: string) =>
			`從建立、閱讀到分享，${name} 都保持清楚的產品邊界，並只連接真正需要的共享能力。`,
		workflow: (name: string) =>
			`以下界面以 ${name} 的核心任務為中心；不把其他產品的完整說明複製進來。`,
		boundary: (name: string) =>
			`${name} 只公開已由使用者確認、有效 Outline 文件或 schema 支持的能力。`,
		q1: (name: string) => `${name} 的畫面是真實產品截圖嗎？`,
		a1: "目前標示為「概念預覽」的畫面是程式碼原生產品展位，可在不改變版面的情況下替換成真實截圖。",
		q2: "頁面上的實作狀態如何判定？",
		a2: "狀態來自集中產品事實，不會因導覽分組或行銷文案而改變。",
	},
	"zh-hans": {
		scenario: (name: string) =>
			`从创建、阅读到分享，${name} 都保持清楚边界，并只连接真正需要的共享能力。`,
		workflow: (name: string) => `以下界面围绕 ${name} 的核心任务，不复制其他产品的完整说明。`,
		boundary: (name: string) =>
			`${name} 只公开由用户确认、有效 Outline 文档或 schema 支持的能力。`,
		q1: (name: string) => `${name} 的画面是真实产品截图吗？`,
		a1: "标记为“概念预览”的画面是代码原生展位，可在不改变布局的情况下替换成真实截图。",
		q2: "页面上的实现状态如何判定？",
		a2: "状态来自集中的产品事实，不会因导航分组或营销文案改变。",
	},
	en: {
		scenario: (name: string) =>
			`From creation through reading and sharing, ${name} keeps a clear boundary and connects only the capabilities it actually uses.`,
		workflow: (name: string) =>
			`The interface below centers the core ${name} task without duplicating entire capability pages.`,
		boundary: (name: string) =>
			`${name} only presents capabilities supported by confirmed user facts, current Outline documents, or schema evidence.`,
		q1: (name: string) => `Is the ${name} interface a real product screenshot?`,
		a1: "Views labeled “Concept preview” are code-native product stages designed to be replaced by real screenshots without changing layout.",
		q2: "How is implementation status determined?",
		a2: "Status comes from the centralized product facts and never changes merely because of navigation or marketing copy.",
	},
	ja: {
		scenario: (name: string) =>
			`作成、閲覧、共有を通じて ${name} の境界を保ち、必要な共有機能だけを接続します。`,
		workflow: (name: string) =>
			`以下は ${name} の中心的な作業に集中し、他ページの説明を重複させません。`,
		boundary: (name: string) =>
			`${name} は確認済み情報、現行文書、schema に基づく機能だけを公開します。`,
		q1: (name: string) => `${name} の画面は実際のスクリーンショットですか？`,
		a1: "「コンセプトプレビュー」はコードで作成され、同じレイアウトのまま実画面に差し替えられます。",
		q2: "実装状態はどのように決まりますか？",
		a2: "集中管理された製品情報に基づき、ナビゲーションや宣伝文で変更されません。",
	},
	de: {
		scenario: (name: string) =>
			`Von Erstellung bis Teilen behält ${name} klare Grenzen und nutzt nur wirklich benötigte Fähigkeiten.`,
		workflow: (name: string) =>
			`Die Ansicht konzentriert sich auf die Kernaufgabe von ${name}, ohne andere Produktseiten zu kopieren.`,
		boundary: (name: string) =>
			`${name} zeigt nur Fähigkeiten mit bestätigter Nutzer-, Dokument- oder Schema-Grundlage.`,
		q1: (name: string) => `Ist die Ansicht von ${name} ein echter Screenshot?`,
		a1: "Als „Konzeptvorschau“ markierte Ansichten sind im Code gebaut und können ohne Layoutänderung ersetzt werden.",
		q2: "Wie wird der Implementierungsstatus bestimmt?",
		a2: "Der Status stammt aus zentralen Produktfakten und ändert sich nicht durch Navigation oder Marketingtexte.",
	},
	ko: {
		scenario: (name: string) =>
			`만들기, 읽기, 공유 전 과정에서 ${name}의 경계를 유지하고 실제 필요한 공유 기능만 연결합니다.`,
		workflow: (name: string) =>
			`아래 화면은 ${name}의 핵심 작업에 집중하며 다른 제품 설명을 복제하지 않습니다.`,
		boundary: (name: string) =>
			`${name}는 사용자 확인, 현행 문서, schema가 뒷받침하는 기능만 공개합니다.`,
		q1: (name: string) => `${name} 화면은 실제 제품 스크린샷인가요?`,
		a1: "‘콘셉트 미리보기’ 화면은 코드로 만든 전시이며 레이아웃을 바꾸지 않고 실제 화면으로 교체할 수 있습니다.",
		q2: "구현 상태는 어떻게 결정하나요?",
		a2: "중앙 제품 사실에서 정하며 내비게이션이나 홍보 문구 때문에 바뀌지 않습니다.",
	},
} as const;

export function getLocalizedProductCopy(
	locale: AboutLocale,
	productId: ProductId,
): LocalizedProductCopy {
	const product = PRODUCT_DEFINITIONS.find((entry) => entry.id === productId);
	if (!product) {
		throw new Error(`Unknown product: ${productId}`);
	}

	const language = DETAIL_LANGUAGE[locale];
	const summaries = SUMMARY_BY_LOCALE[locale] as Record<string, string>;
	const summary = summaries[productId];
	return {
		summary,
		value: summary,
		scenarioLead: language.scenario(product.name),
		workflowLead: language.workflow(product.name),
		boundaryLead: language.boundary(product.name),
		faq: [
			{ question: language.q1(product.name), answer: language.a1 },
			{ question: language.q2, answer: language.a2 },
		],
	};
}

export function getAllLocalizedProductCopy(
	locale: AboutLocale,
): Record<ProductId, LocalizedProductCopy> {
	return Object.fromEntries(
		PRODUCT_DEFINITIONS.map((product) => [
			product.id,
			getLocalizedProductCopy(locale, product.id),
		]),
	) as Record<ProductId, LocalizedProductCopy>;
}

export { SUMMARY_BY_LOCALE };
