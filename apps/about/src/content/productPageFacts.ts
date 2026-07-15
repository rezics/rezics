import type { AboutLocale } from "../i18n/locales";
import type { ProductDefinition } from "./productTypes";
import type { LocalizedProductCopy } from "./productTypes";

export type ProductPageFacts = {
	scenarios: readonly string[];
	workflow: readonly string[];
	boundaries: readonly string[];
};

const SPECIAL_FACTS = {
	"zh-hant": {
		book: {
			scenarios: [
				"在同一個 Book 身份下查看 main 與 variants，而不是把每個版本拆成沒有關係的作品。",
				"由 ContentStructure 生成章節目錄；同一個 Post 可以在不同 occurrence 中復用。",
				"在 Book credits 與 subjects 中分別管理作者、譯者、出版商、角色、主角與二創關係。",
			],
			workflow: [
				"建立或選擇 Book 的整體身份，連接 main 與 variants。",
				"用 ContentStructure 排列章節 occurrence，普通閱讀直接得到樹狀目錄。",
				"發佈後，Book 欄位與目錄變更進入各自的 History 適配。",
			],
			boundaries: [
				"GameBook 是 Book 使用 GameContentStructure 形成的產品形態，不是 Content Structure 的子產品。",
				"Chapter 是協議概念，不建立獨立產品頁；章節內容仍由 Post 與 occurrence 表達。",
				"CreditAttribution 處理創作與出版；SubjectAttribution 處理角色、主題和二創關係。",
			],
		},
		gamebook: {
			scenarios: [
				"讀者從 Entrance 進入 Passage，透過 Choice 到達分支、匯合或 Ending。",
				"作者在實際結構編輯器中驗證入口、穩定 ID、退役節點與 DAG。",
				"Journey 與 JourneyStep 保留本次路徑；Progress 只提供通用摘要。",
			],
			workflow: [
				"先建立 Book，再為其啟用 GameContentStructure。",
				"配置 Entrance、Passage、Choice、Ending 與版面，並通過無環驗證。",
				"讀者選擇寫入 JourneyStep；退役內容保留既有路徑的可解釋性。",
			],
			boundaries: [
				"父產品始終是 Book；GameContentStructure 是 Content Structure 的可選能力模式。",
				"不包含變數、條件、腳本、戰鬥、環或視覺小說運行時。",
				"Progress 不保存 Journey，也不替代 GameBook 的路徑歷史。",
			],
		},
		"content-structure": {
			scenarios: [
				"ContentStructure 以有序樹管理內容出現位置、排序和復用。",
				"GameContentStructure 疊加入口、Passage、Ending、Choice、版面、退役與 DAG 校驗。",
				"目前公開展示已確認的 Book 適配：章節目錄與 GameBook。",
			],
			workflow: [
				"在 Tree 模式建立 occurrence；Node 不等於 Post。",
				"需要分支閱讀時切換 Game 模式，仍以普通結構為基礎。",
				"在 Book 與 GameBook 讀者結果中驗證結構，而不是把編輯器當成最終產品。",
			],
			boundaries: [
				"Content Structure 沒有載體父產品，也不是 GameBook 的父產品。",
				"Editor 負責編輯體驗，History 負責已發佈版本，API 負責外部存取；三者不等於 Structure。",
				"Media、Series 等適配在文件確認之前不公開聲稱已支持。",
			],
		},
		history: {
			scenarios: [
				"選擇 Book 欄位、Post 區塊或 Zone 配置，查看其自己的歷史範圍。",
				"在已發佈版本之間查看欄位級或區塊級差異。",
				"確認鎖定狀態與作用範圍，再進入對應產品的編輯流程。",
			],
			workflow: [
				"產品適配器指定 History 的欄位或區塊範圍。",
				"只有發佈邊界產生正式版本；草稿操作不寫入正式 History。",
				"版本清單、差異與鎖共同回到 Book、Post、Zone 的實際界面。",
			],
			boundaries: [
				"History 是獨立核心能力，不隸屬於 Editor。",
				"不同產品不被強迫採用同一種整物件快照。",
				"本頁不聲稱自動合併、固定鎖過期、強制搶鎖或任意版本恢復已實作。",
			],
		},
		"entity-attribution": {
			scenarios: [
				"Entity 同時表示作者、譯者、出版商等現實實體，以及角色等虛擬實體。",
				"CreditAttribution 描述作者、譯者、出版商與其他貢獻或出版關係。",
				"SubjectAttribution 描述角色、主角、相關角色與二創或衍生關係。",
			],
			workflow: [
				"選擇穩定的 Entity 記錄，而不是只輸入無身份的名字字串。",
				"在 Credit 或 Subject 編輯區選擇關係類型、Entity 與目標 Unit。",
				"在 Book、Post、Wiki、Picture、Media 或 Software 的詳情中查看結果。",
			],
			boundaries: [
				"Attribution 描述 Entity 與 Unit 的關係；Tag 不替代 Attribution。",
				"SubjectAttribution 不等於 CreditAttribution，角色關係不被當成作者關係。",
				"Source / Provenance 是後續擴展，不在首版冒充完整已實作產品。",
			],
		},
		zone: {
			scenarios: [
				"以 Block Schema 組合 Header、Feed、Shelf 等區塊。",
				"用查詢和配置決定 Zone 顯示哪些內容，而不是把內容直接歸 Zone 所有。",
				"配置變更使用 Zone 自己的 History 適配。",
			],
			workflow: [
				"選擇區塊並配置每個區塊的查詢或引用。",
				"在產品預覽中確認 Feed 卡片與目錄結果。",
				"發佈配置後形成可追溯的 Zone 版本。",
			],
			boundaries: [
				"Zone 是查詢與配置形成的空間，不是內容所有權容器。",
				"Block Schema 與 Zone Atom 是內部協議，只在 Zone 頁與開發文件中說明。",
				"Feed 負責內容流；輪播屬於 Dock 類界面，不由 Feed 冒充。",
			],
		},
	},
	"zh-hans": {
		book: {
			scenarios: [
				"在同一个 Book 身份下查看 main 与 variants，而不是把每个版本拆成无关作品。",
				"由 ContentStructure 生成章节目录；同一个 Post 可以在不同 occurrence 中复用。",
				"分别管理作者、译者、出版商、角色、主角与二创关系。",
			],
			workflow: [
				"建立 Book 整体身份并连接 main 与 variants。",
				"用 ContentStructure 排列章节 occurrence，得到树状目录。",
				"发布后，Book 字段与目录进入各自的 History 适配。",
			],
			boundaries: [
				"GameBook 是 Book 使用 GameContentStructure 形成的产品形态。",
				"Chapter 是协议概念，不建立独立产品页。",
				"CreditAttribution 与 SubjectAttribution 分别处理贡献和主题关系。",
			],
		},
		gamebook: {
			scenarios: [
				"读者从 Entrance 进入 Passage，经 Choice 到达分支、汇合或 Ending。",
				"作者验证入口、稳定 ID、退役节点和 DAG。",
				"Journey 与 JourneyStep 保存路径；Progress 只提供通用摘要。",
			],
			workflow: [
				"先建立 Book，再启用 GameContentStructure。",
				"配置 Entrance、Passage、Choice、Ending 并通过无环验证。",
				"读者选择写入 JourneyStep，退役内容保留历史可解释性。",
			],
			boundaries: [
				"父产品始终是 Book；GameContentStructure 只是能力模式。",
				"不包含变量、条件、脚本、战斗、环或视觉小说运行时。",
				"Progress 不保存 Journey。",
			],
		},
		"content-structure": {
			scenarios: [
				"ContentStructure 用有序树管理位置、排序和复用。",
				"GameContentStructure 叠加入口、Passage、Ending、Choice、退役和 DAG 校验。",
				"首批只公开已确认的 Book 适配。",
			],
			workflow: [
				"Tree 模式建立 occurrence；Node 不等于 Post。",
				"Game 模式仍建立在普通结构之上。",
				"在 Book 与 GameBook 读者结果中验证结构。",
			],
			boundaries: [
				"Content Structure 没有载体父产品，也不是 GameBook 父产品。",
				"Editor、History、API 各有不同职责。",
				"Media、Series 等适配未经文档确认前不公开声称支持。",
			],
		},
		history: {
			scenarios: [
				"选择 Book 字段、Post 区块或 Zone 配置查看对应历史范围。",
				"在已发布版本之间查看字段或区块差异。",
				"确认锁定状态和作用范围。",
			],
			workflow: [
				"产品适配器指定字段或区块范围。",
				"只有发布边界产生正式版本，草稿操作不写入正式 History。",
				"版本、差异与锁回到 Book、Post、Zone 的实际界面。",
			],
			boundaries: [
				"History 独立于 Editor。",
				"产品不被强制采用统一整对象快照。",
				"不声称自动合并、固定锁过期、强制抢锁或任意版本恢复已实现。",
			],
		},
		"entity-attribution": {
			scenarios: [
				"Entity 同时表示现实实体和角色等虚拟实体。",
				"CreditAttribution 描述作者、译者、出版商等贡献与出版关系。",
				"SubjectAttribution 描述角色、主角与二创关系。",
			],
			workflow: [
				"选择稳定 Entity，而不是只输入字符串名字。",
				"选择关系类型、Entity 和目标 Unit。",
				"在 Book、Post、Media、Software 等产品详情中查看结果。",
			],
			boundaries: [
				"Attribution 描述 Entity 与 Unit 的关系；Tag 不能替代它。",
				"SubjectAttribution 不等于 CreditAttribution。",
				"Source / Provenance 是后续扩展。",
			],
		},
		zone: {
			scenarios: [
				"用 Block Schema 组合 Header、Feed、Shelf 等区块。",
				"查询与配置决定 Zone 展示内容，不改变内容所有权。",
				"配置变更使用 Zone 的 History 适配。",
			],
			workflow: [
				"选择区块并配置查询或引用。",
				"在预览中确认 Feed 卡片与目录结果。",
				"发布配置形成可追溯版本。",
			],
			boundaries: [
				"Zone 不是内容所有权容器。",
				"Block Schema 与 Zone Atom 只作为内部协议说明。",
				"Feed 负责内容流，轮播不是 Feed 能力。",
			],
		},
	},
	en: {
		book: {
			scenarios: [
				"See main and variants under one Book identity rather than splitting every edition into unrelated works.",
				"Generate chapter order from ContentStructure and reuse one Post through separate occurrences.",
				"Manage authors, translators, publishers, characters, protagonists, and derivative relations.",
			],
			workflow: [
				"Create the Book identity and connect main with its variants.",
				"Arrange chapter occurrences in ContentStructure to produce the reading tree.",
				"At publication, Book fields and structure enter their respective History adapters.",
			],
			boundaries: [
				"GameBook is a Book manifestation using GameContentStructure.",
				"Chapter is a protocol concept, not an independent public product.",
				"CreditAttribution and SubjectAttribution serve contribution and subject relations respectively.",
			],
		},
		gamebook: {
			scenarios: [
				"Readers move from Entrance through Passage and Choice to branches, merges, or Ending.",
				"Authors validate entry points, stable IDs, retired nodes, and a directed acyclic structure.",
				"Journey and JourneyStep retain the path while Progress exposes only a general summary.",
			],
			workflow: [
				"Create a Book, then enable GameContentStructure.",
				"Configure Entrance, Passage, Choice, Ending, and layout, then pass DAG validation.",
				"Write choices to JourneyStep while retired content keeps existing paths explainable.",
			],
			boundaries: [
				"The parent is always Book; GameContentStructure is an optional capability mode.",
				"There are no variables, conditions, scripts, combat, loops, or visual-novel runtime.",
				"Progress does not store Journey.",
			],
		},
		"content-structure": {
			scenarios: [
				"ContentStructure uses an ordered tree for placement, order, and reuse.",
				"GameContentStructure adds Entrance, Passage, Ending, Choice, retirement, layout, and DAG validation.",
				"The first public adapter is the confirmed Book integration.",
			],
			workflow: [
				"Create occurrences in Tree mode; a Node is not the same thing as a Post.",
				"Switch to Game mode when branching is needed, still layered over the ordinary structure.",
				"Validate the resulting Book directory or GameBook reader experience.",
			],
			boundaries: [
				"Content Structure has no carrier parent and is not GameBook’s parent.",
				"Editor, History, and API have distinct responsibilities.",
				"Media and Series adapters are not advertised until their current documents confirm them.",
			],
		},
		history: {
			scenarios: [
				"Choose a Book field, Post block, or Zone configuration to inspect its own history scope.",
				"Compare field- or block-level differences between published versions.",
				"Inspect lock state and scope before returning to the consuming product.",
			],
			workflow: [
				"A product adapter defines the field or block scope.",
				"Only publication creates a formal version; draft operations remain outside formal History.",
				"Versions, diffs, and locks appear within Book, Post, and Zone interfaces.",
			],
			boundaries: [
				"History is an independent core capability, not part of Editor.",
				"Products are not forced into a universal whole-object snapshot.",
				"This page does not claim automatic merge, fixed lock expiry, forced takeover, or arbitrary restore.",
			],
		},
		"entity-attribution": {
			scenarios: [
				"Entity represents real people and organizations as well as fictional characters.",
				"CreditAttribution expresses authors, translators, publishers, and other contribution roles.",
				"SubjectAttribution expresses characters, protagonists, and derivative relations.",
			],
			workflow: [
				"Select a stable Entity record instead of entering an identity-less name string.",
				"Choose Credit or Subject, a relationship type, the Entity, and the target Unit.",
				"Review the result in Book, Post, Wiki, Picture, Media, or Software.",
			],
			boundaries: [
				"Attribution relates Entity and Unit; Tag is not a replacement.",
				"SubjectAttribution is not CreditAttribution.",
				"Source / Provenance is a later extension, not a complete first-release product.",
			],
		},
		zone: {
			scenarios: [
				"Compose Header, Feed, Shelf, and other blocks through Block Schema.",
				"Use queries and configuration to decide what appears without transferring ownership.",
				"Track published configuration through a Zone-specific History adapter.",
			],
			workflow: [
				"Select blocks and configure each query or reference.",
				"Verify Feed cards and catalog results in the product preview.",
				"Publish the configuration as a traceable Zone version.",
			],
			boundaries: [
				"Zone is a query-and-configuration space, not a content ownership container.",
				"Block Schema and Zone Atom remain internal protocols.",
				"Feed owns content streams; carousel behavior belongs to a Dock-like surface.",
			],
		},
	},
	ja: {
		book: {
			scenarios: [
				"一つの Book 同一性で main と variants を確認します。",
				"ContentStructure が章を並べ、同じ Post を occurrence として再利用します。",
				"著者、翻訳者、出版社、登場人物の関係を管理します。",
			],
			workflow: [
				"Book の同一性と版の関係を作成します。",
				"章 occurrence を構造に配置します。",
				"公開後にフィールドと構造を各 History へ記録します。",
			],
			boundaries: [
				"GameBook は Book の形態です。",
				"Chapter は独立プロダクトではありません。",
				"Credit と Subject は異なる関係を扱います。",
			],
		},
		gamebook: {
			scenarios: [
				"Entrance から Passage、Choice、Ending へ読み進めます。",
				"安定 ID、退役、DAG を編集画面で検証します。",
				"Journey と JourneyStep が経路を保持します。",
			],
			workflow: [
				"Book に GameContentStructure を追加します。",
				"分岐を設定して無環検証を行います。",
				"選択を JourneyStep に記録します。",
			],
			boundaries: [
				"親は常に Book です。",
				"変数、スクリプト、戦闘、ループは含みません。",
				"Progress は Journey を保存しません。",
			],
		},
		"content-structure": {
			scenarios: [
				"有序木で配置、順序、再利用を管理します。",
				"Game モードが分岐と DAG 検証を追加します。",
				"最初の公開アダプタは Book です。",
			],
			workflow: [
				"Node ではなく occurrence を配置します。",
				"Game モードも通常構造を基礎にします。",
				"Book または GameBook の結果を検証します。",
			],
			boundaries: [
				"載体となる親はありません。",
				"Editor、History、API は別の責務です。",
				"未確認アダプタは公開しません。",
			],
		},
		history: {
			scenarios: [
				"Book、Post、Zone ごとの履歴範囲を選びます。",
				"公開済み版の差分を確認します。",
				"ロック状態と範囲を確認します。",
			],
			workflow: [
				"アダプタがフィールドまたはブロック範囲を定義します。",
				"公開だけが正式版を作ります。",
				"結果を利用プロダクト画面に戻します。",
			],
			boundaries: [
				"History は Editor から独立しています。",
				"共通の全体スナップショットを強制しません。",
				"自動マージや強制ロック取得を実装済みと主張しません。",
			],
		},
		"entity-attribution": {
			scenarios: [
				"Entity は現実と架空の対象を表します。",
				"Credit は著者、翻訳者、出版社を表します。",
				"Subject は登場人物、主人公、二次創作を表します。",
			],
			workflow: [
				"安定した Entity を選びます。",
				"関係タイプと対象 Unit を指定します。",
				"各プロダクト詳細で結果を確認します。",
			],
			boundaries: [
				"Tag は Attribution の代替ではありません。",
				"Credit と Subject は異なります。",
				"Source / Provenance は今後の拡張です。",
			],
		},
		zone: {
			scenarios: [
				"Block Schema で区画を構成します。",
				"クエリで表示を決め、所有権は移しません。",
				"設定変更を Zone の History に記録します。",
			],
			workflow: [
				"区画とクエリを設定します。",
				"Feed とカタログ結果を確認します。",
				"設定を公開版にします。",
			],
			boundaries: [
				"Zone は所有権コンテナではありません。",
				"Block Schema と Zone Atom は内部規約です。",
				"Feed はカルーセル機能ではありません。",
			],
		},
	},
	de: {
		book: {
			scenarios: [
				"main und variants bleiben unter einer Book-Identität.",
				"ContentStructure ordnet Kapitel und wiederverwendet Posts als Vorkommen.",
				"Credit und Subject verwalten Beiträge und Figurenbeziehungen.",
			],
			workflow: [
				"Book-Identität und Varianten verbinden.",
				"Kapitelvorkommen strukturieren.",
				"Veröffentlichte Felder und Struktur in History erfassen.",
			],
			boundaries: [
				"GameBook ist eine Form von Book.",
				"Chapter ist kein eigenständiges Produkt.",
				"Credit und Subject haben verschiedene Aufgaben.",
			],
		},
		gamebook: {
			scenarios: [
				"Von Entrance über Passage und Choice zum Ending lesen.",
				"Stabile IDs, Ruhestand und DAG prüfen.",
				"JourneyStep hält den gewählten Pfad fest.",
			],
			workflow: [
				"GameContentStructure für Book aktivieren.",
				"Verzweigungen konfigurieren und validieren.",
				"Auswahl in JourneyStep erfassen.",
			],
			boundaries: [
				"Das Elternprodukt ist immer Book.",
				"Keine Variablen, Skripte, Kämpfe oder Schleifen.",
				"Progress speichert keine Journey.",
			],
		},
		"content-structure": {
			scenarios: [
				"Geordneter Baum für Position, Reihenfolge und Wiederverwendung.",
				"Game-Modus ergänzt Verzweigung und DAG-Prüfung.",
				"Der erste öffentliche Adapter ist Book.",
			],
			workflow: [
				"Vorkommen statt Posts als Knoten platzieren.",
				"Game auf die normale Struktur aufsetzen.",
				"Book- oder GameBook-Ergebnis prüfen.",
			],
			boundaries: [
				"Kein übergeordnetes Trägerprodukt.",
				"Editor, History und API bleiben getrennt.",
				"Unbestätigte Adapter werden nicht beworben.",
			],
		},
		history: {
			scenarios: [
				"Historienbereich für Book, Post oder Zone wählen.",
				"Veröffentlichte Versionen vergleichen.",
				"Sperrstatus und Bereich prüfen.",
			],
			workflow: [
				"Adapter definiert Feld- oder Blockbereich.",
				"Nur Veröffentlichung erzeugt eine formale Version.",
				"Ergebnis in der Produktansicht zeigen.",
			],
			boundaries: [
				"History ist unabhängig von Editor.",
				"Kein universeller Gesamt-Snapshot.",
				"Automatische Zusammenführung oder erzwungene Sperrübernahme wird nicht behauptet.",
			],
		},
		"entity-attribution": {
			scenarios: [
				"Entity kann reale und fiktive Objekte darstellen.",
				"Credit beschreibt Autoren, Übersetzer und Verlage.",
				"Subject beschreibt Figuren, Hauptrollen und Ableitungen.",
			],
			workflow: [
				"Stabilen Entity-Datensatz wählen.",
				"Beziehung und Ziel-Unit bestimmen.",
				"Ergebnis im jeweiligen Produkt prüfen.",
			],
			boundaries: [
				"Tag ersetzt Attribution nicht.",
				"Credit und Subject sind verschieden.",
				"Source / Provenance ist eine spätere Erweiterung.",
			],
		},
		zone: {
			scenarios: [
				"Bereiche mit Block Schema zusammensetzen.",
				"Anzeige über Abfragen bestimmen, ohne Eigentum zu übertragen.",
				"Veröffentlichte Konfiguration in History halten.",
			],
			workflow: [
				"Blöcke und Abfragen konfigurieren.",
				"Feed- und Katalogergebnis prüfen.",
				"Konfiguration veröffentlichen.",
			],
			boundaries: [
				"Zone besitzt verlinkte Inhalte nicht.",
				"Block Schema und Zone Atom sind interne Protokolle.",
				"Feed ist keine Karussellfunktion.",
			],
		},
	},
	ko: {
		book: {
			scenarios: [
				"하나의 Book 정체성 아래 main과 variants를 봅니다.",
				"ContentStructure가 장을 배열하고 Post를 occurrence로 재사용합니다.",
				"기여 관계와 등장인물 관계를 분리해 관리합니다.",
			],
			workflow: [
				"Book 정체성과 판본을 연결합니다.",
				"장 occurrence를 구조에 배치합니다.",
				"공개된 필드와 구조를 각각 History에 기록합니다.",
			],
			boundaries: [
				"GameBook은 Book의 제품 형태입니다.",
				"Chapter는 독립 제품이 아닙니다.",
				"Credit과 Subject는 서로 다른 관계를 담당합니다.",
			],
		},
		gamebook: {
			scenarios: [
				"Entrance에서 Passage와 Choice를 거쳐 Ending으로 읽습니다.",
				"안정 ID, 폐기, DAG를 편집기에서 검사합니다.",
				"Journey와 JourneyStep이 경로를 보존합니다.",
			],
			workflow: [
				"Book에 GameContentStructure를 켭니다.",
				"분기를 설정하고 무순환 검사를 합니다.",
				"선택을 JourneyStep에 기록합니다.",
			],
			boundaries: [
				"상위 제품은 항상 Book입니다.",
				"변수, 스크립트, 전투, 반복은 포함하지 않습니다.",
				"Progress는 Journey를 저장하지 않습니다.",
			],
		},
		"content-structure": {
			scenarios: [
				"순서 트리로 위치, 순서, 재사용을 관리합니다.",
				"Game 모드가 분기와 DAG 검사를 더합니다.",
				"첫 공개 어댑터는 Book입니다.",
			],
			workflow: [
				"Post가 아니라 occurrence를 배치합니다.",
				"Game 모드도 일반 구조 위에 놓입니다.",
				"Book 또는 GameBook 결과를 확인합니다.",
			],
			boundaries: [
				"운반 상위 제품이 없습니다.",
				"Editor, History, API는 역할이 다릅니다.",
				"확인되지 않은 어댑터는 공개하지 않습니다.",
			],
		},
		history: {
			scenarios: [
				"Book, Post, Zone의 이력 범위를 선택합니다.",
				"공개 버전의 차이를 봅니다.",
				"잠금 상태와 범위를 확인합니다.",
			],
			workflow: [
				"어댑터가 필드 또는 블록 범위를 정합니다.",
				"공개만 정식 버전을 만듭니다.",
				"결과를 사용 제품 화면에 보여 줍니다.",
			],
			boundaries: [
				"History는 Editor와 독립입니다.",
				"공통 전체 객체 스냅샷을 강제하지 않습니다.",
				"자동 병합이나 강제 잠금 인수를 구현됐다고 주장하지 않습니다.",
			],
		},
		"entity-attribution": {
			scenarios: [
				"Entity는 현실 및 가상 대상을 나타냅니다.",
				"Credit은 저자, 번역자, 출판사를 나타냅니다.",
				"Subject는 등장인물, 주인공, 2차 창작을 나타냅니다.",
			],
			workflow: [
				"안정적인 Entity를 고릅니다.",
				"관계 유형과 대상 Unit을 정합니다.",
				"각 제품 상세에서 결과를 확인합니다.",
			],
			boundaries: [
				"Tag는 Attribution을 대체하지 않습니다.",
				"Credit과 Subject는 다릅니다.",
				"Source / Provenance는 이후 확장입니다.",
			],
		},
		zone: {
			scenarios: [
				"Block Schema로 영역을 구성합니다.",
				"쿼리로 표시를 정하고 소유권은 옮기지 않습니다.",
				"설정 변경을 Zone History에 기록합니다.",
			],
			workflow: [
				"블록과 쿼리를 설정합니다.",
				"Feed와 카탈로그 결과를 확인합니다.",
				"설정을 공개 버전으로 만듭니다.",
			],
			boundaries: [
				"Zone은 콘텐츠 소유 컨테이너가 아닙니다.",
				"Block Schema와 Zone Atom은 내부 프로토콜입니다.",
				"Feed는 캐러셀 기능이 아닙니다.",
			],
		},
	},
} as const satisfies Record<AboutLocale, Partial<Record<string, ProductPageFacts>>>;

const GENERIC_TEXT = {
	"zh-hant": {
		scenarios: (product: ProductDefinition, copy: LocalizedProductCopy) => [
			copy.summary,
			`${product.name} 只連接註冊表中明確列出的共享能力。`,
			"產品身份、相關產品與發佈狀態保持可追溯。",
		],
		workflow: (product: ProductDefinition) => [
			`建立或選擇 ${product.name} 的穩定記錄。`,
			"在產品自己的界面完成核心任務。",
			"發佈後由相關 History 與 API 能力承接後續工作。",
		],
		boundaries: (product: ProductDefinition) => [
			`${product.name} 不會被包裝成超出目前事實來源的能力。`,
			"內部協議只在相關產品與開發文件中說明。",
			"導覽分組不改變產品的領域關係。",
		],
	},
	"zh-hans": {
		scenarios: (product: ProductDefinition, copy: LocalizedProductCopy) => [
			copy.summary,
			`${product.name} 只连接注册表明确列出的共享能力。`,
			"产品身份、相关产品与发布状态保持可追溯。",
		],
		workflow: (product: ProductDefinition) => [
			`建立或选择 ${product.name} 的稳定记录。`,
			"在产品自己的界面完成核心任务。",
			"发布后由相关 History 与 API 能力承接。",
		],
		boundaries: (product: ProductDefinition) => [
			`${product.name} 不会被包装成超出事实来源的能力。`,
			"内部协议只在相关产品与开发文档中说明。",
			"导航分组不改变领域关系。",
		],
	},
	en: {
		scenarios: (product: ProductDefinition, copy: LocalizedProductCopy) => [
			copy.summary,
			`${product.name} connects only the capabilities explicitly listed in the registry.`,
			"Identity, related products, and publication status remain traceable.",
		],
		workflow: (product: ProductDefinition) => [
			`Create or select a stable ${product.name} record.`,
			"Complete the core task in the product’s own interface.",
			"At publication, connected History and API capabilities continue the workflow.",
		],
		boundaries: (product: ProductDefinition) => [
			`${product.name} is not presented beyond its supported fact sources.`,
			"Internal protocols remain in related product pages and developer documentation.",
			"Navigation grouping does not change domain relationships.",
		],
	},
	ja: {
		scenarios: (product: ProductDefinition, copy: LocalizedProductCopy) => [
			copy.summary,
			`${product.name} は登録済みの共有機能だけを接続します。`,
			"同一性、関連製品、公開状態を追跡できます。",
		],
		workflow: (product: ProductDefinition) => [
			`${product.name} の安定レコードを選びます。`,
			"固有の画面で中心作業を完了します。",
			"公開後は History と API が後続処理を担います。",
		],
		boundaries: (product: ProductDefinition) => [
			`${product.name} は情報源を超える機能を主張しません。`,
			"内部規約は関連ページと開発文書に置きます。",
			"ナビゲーションは領域関係を変えません。",
		],
	},
	de: {
		scenarios: (product: ProductDefinition, copy: LocalizedProductCopy) => [
			copy.summary,
			`${product.name} nutzt nur ausdrücklich registrierte Fähigkeiten.`,
			"Identität, Beziehungen und Veröffentlichungsstatus bleiben nachvollziehbar.",
		],
		workflow: (product: ProductDefinition) => [
			`Stabilen ${product.name}-Datensatz wählen.`,
			"Kernaufgabe in der eigenen Oberfläche erledigen.",
			"Nach Veröffentlichung schließen History und API an.",
		],
		boundaries: (product: ProductDefinition) => [
			`${product.name} behauptet keine unbelegten Fähigkeiten.`,
			"Interne Protokolle bleiben in Produkt- und Entwicklerdokumentation.",
			"Navigation ändert keine Domänenbeziehung.",
		],
	},
	ko: {
		scenarios: (product: ProductDefinition, copy: LocalizedProductCopy) => [
			copy.summary,
			`${product.name}는 등록부에 명시된 공유 기능만 연결합니다.`,
			"정체성, 관련 제품, 공개 상태를 추적할 수 있습니다.",
		],
		workflow: (product: ProductDefinition) => [
			`안정적인 ${product.name} 레코드를 고릅니다.`,
			"제품 고유 화면에서 핵심 작업을 끝냅니다.",
			"공개 뒤에는 History와 API가 이어받습니다.",
		],
		boundaries: (product: ProductDefinition) => [
			`${product.name}는 출처가 뒷받침하지 않는 기능을 주장하지 않습니다.`,
			"내부 프로토콜은 관련 페이지와 개발 문서에 둡니다.",
			"내비게이션은 도메인 관계를 바꾸지 않습니다.",
		],
	},
} as const;

export function getProductPageFacts(
	locale: AboutLocale,
	product: ProductDefinition,
	copy: LocalizedProductCopy,
): ProductPageFacts {
	const localizedSpecial = SPECIAL_FACTS[locale] as Partial<Record<string, ProductPageFacts>>;
	const special = localizedSpecial[product.id];
	if (special) return special;

	const generic = GENERIC_TEXT[locale];
	return {
		scenarios: generic.scenarios(product, copy),
		workflow: generic.workflow(product),
		boundaries: generic.boundaries(product),
	};
}
