import type { AboutLocale } from "../i18n/locales";

type InterfaceCopy = {
	home: {
		eyebrows: {
			stage: string;
			products: string;
			platform: string;
			composition: string;
			history: string;
			openSource: string;
		};
		formulaResults: {
			chapters: string;
			credits: string;
			subjects: string;
		};
		historyConsumers: {
			book: string;
			post: string;
			zone: string;
		};
		openDescriptions: {
			outline: string;
			api: string;
			github: string;
		};
	};
	a11y: {
		skipContent: string;
		primaryNavigation: string;
		mobileNavigation: string;
		breadcrumb: string;
		modes: string;
	};
};

export const INTERFACE_COPY = {
	"zh-hant": {
		home: {
			eyebrows: {
				stage: "產品展台",
				products: "產品",
				platform: "平台能力",
				composition: "能力組合",
				history: "歷史",
				openSource: "開放源碼",
			},
			formulaResults: {
				chapters: "章節目錄",
				credits: "作者・譯者・出版關係",
				subjects: "角色・主題・二創關係",
			},
			historyConsumers: {
				book: "Book 欄位和 ContentStructure 各自使用適合其已發佈資料的 History 範圍。",
				post: "已發佈內容區塊產生欄位級或區塊級版本；草稿操作不進入正式 History。",
				zone: "Zone 配置和查詢變更使用自己的適配器，而不是通用整物件快照。",
			},
			openDescriptions: {
				outline: "產品決策與現行領域文件。",
				api: "為應用、整合與 MCP 提供權限化入口。",
				github: "Rezics 生態的源碼、Issue 與貢獻入口。",
			},
		},
		a11y: {
			skipContent: "跳到主要內容",
			primaryNavigation: "主要導覽",
			mobileNavigation: "行動版導覽",
			breadcrumb: "麵包屑",
			modes: "能力模式",
		},
	},
	"zh-hans": {
		home: {
			eyebrows: {
				stage: "产品展台",
				products: "产品",
				platform: "平台能力",
				composition: "能力组合",
				history: "历史",
				openSource: "开放源代码",
			},
			formulaResults: {
				chapters: "章节目录",
				credits: "作者・译者・出版关系",
				subjects: "角色・主题・二创关系",
			},
			historyConsumers: {
				book: "Book 字段和 ContentStructure 各自使用适合其已发布数据的 History 范围。",
				post: "已发布内容区块产生字段级或区块级版本；草稿操作不进入正式 History。",
				zone: "Zone 配置和查询变更使用自己的适配器，而不是通用整对象快照。",
			},
			openDescriptions: {
				outline: "产品决策与当前领域文档。",
				api: "为应用、集成与 MCP 提供权限化入口。",
				github: "Rezics 生态的源代码、Issue 与贡献入口。",
			},
		},
		a11y: {
			skipContent: "跳到主要内容",
			primaryNavigation: "主要导航",
			mobileNavigation: "移动端导航",
			breadcrumb: "面包屑",
			modes: "能力模式",
		},
	},
	en: {
		home: {
			eyebrows: {
				stage: "Product stage",
				products: "Products",
				platform: "Platform",
				composition: "Composition",
				history: "History",
				openSource: "Open source",
			},
			formulaResults: {
				chapters: "Chapter structure",
				credits: "Author, translator, and publisher relations",
				subjects: "Character, subject, and derivative relations",
			},
			historyConsumers: {
				book: "Book fields and ContentStructure each use the History scope that fits their published data.",
				post: "Published content blocks produce field- or block-level revisions; draft operations stay outside formal History.",
				zone: "Zone configuration and query changes use their own adapter rather than a universal object snapshot.",
			},
			openDescriptions: {
				outline: "Product decisions and current domain documents.",
				api: "Permissioned entry points for applications, integrations, and MCP.",
				github: "Source, issues, and contribution entry points for the Rezics ecosystem.",
			},
		},
		a11y: {
			skipContent: "Skip to main content",
			primaryNavigation: "Primary navigation",
			mobileNavigation: "Mobile navigation",
			breadcrumb: "Breadcrumb",
			modes: "Modes",
		},
	},
	ja: {
		home: {
			eyebrows: {
				stage: "製品ステージ",
				products: "製品",
				platform: "プラットフォーム",
				composition: "機能の組み合わせ",
				history: "履歴",
				openSource: "オープンソース",
			},
			formulaResults: {
				chapters: "章構造",
				credits: "著者・翻訳者・出版社の関係",
				subjects: "登場人物・主題・二次創作の関係",
			},
			historyConsumers: {
				book: "Book のフィールドと ContentStructure は、公開済みデータに合う別々の History 範囲を使います。",
				post: "公開されたコンテンツブロックはフィールドまたはブロック単位の版を作り、下書き操作は正式な History に入りません。",
				zone: "Zone の設定とクエリ変更は、共通のオブジェクト全体スナップショットではなく専用アダプタを使います。",
			},
			openDescriptions: {
				outline: "製品判断と現在有効なドメイン文書。",
				api: "アプリ、統合、MCP のための権限付き入口。",
				github: "Rezics エコシステムのソース、Issue、貢献入口。",
			},
		},
		a11y: {
			skipContent: "メインコンテンツへ移動",
			primaryNavigation: "メインナビゲーション",
			mobileNavigation: "モバイルナビゲーション",
			breadcrumb: "パンくずリスト",
			modes: "機能モード",
		},
	},
	de: {
		home: {
			eyebrows: {
				stage: "Produktbühne",
				products: "Produkte",
				platform: "Plattform",
				composition: "Zusammenspiel",
				history: "Historie",
				openSource: "Open Source",
			},
			formulaResults: {
				chapters: "Kapitelstruktur",
				credits: "Beziehungen zu Autoren, Übersetzern und Verlagen",
				subjects: "Figuren-, Themen- und Ableitungsbeziehungen",
			},
			historyConsumers: {
				book: "Book-Felder und ContentStructure verwenden jeweils einen History-Bereich, der zu ihren veröffentlichten Daten passt.",
				post: "Veröffentlichte Inhaltsblöcke erzeugen Feld- oder Blockversionen; Entwurfsoperationen bleiben außerhalb der formalen History.",
				zone: "Änderungen an Zone-Konfiguration und Abfragen nutzen einen eigenen Adapter statt eines universellen Gesamt-Snapshots.",
			},
			openDescriptions: {
				outline: "Produktentscheidungen und aktuelle Domänendokumente.",
				api: "Berechtigte Einstiegspunkte für Anwendungen, Integrationen und MCP.",
				github: "Quellcode, Issues und Beitragswege für das Rezics-Ökosystem.",
			},
		},
		a11y: {
			skipContent: "Zum Hauptinhalt",
			primaryNavigation: "Hauptnavigation",
			mobileNavigation: "Mobile Navigation",
			breadcrumb: "Brotkrümelnavigation",
			modes: "Funktionsmodi",
		},
	},
	ko: {
		home: {
			eyebrows: {
				stage: "제품 전시",
				products: "제품",
				platform: "플랫폼",
				composition: "기능 조합",
				history: "이력",
				openSource: "오픈 소스",
			},
			formulaResults: {
				chapters: "장 구조",
				credits: "저자・번역자・출판 관계",
				subjects: "등장인물・주제・2차 창작 관계",
			},
			historyConsumers: {
				book: "Book 필드와 ContentStructure는 각각 공개 데이터에 맞는 History 범위를 사용합니다.",
				post: "공개된 콘텐츠 블록은 필드 또는 블록 단위 버전을 만들며 초안 작업은 정식 History에 들어가지 않습니다.",
				zone: "Zone 설정과 쿼리 변경은 범용 전체 객체 스냅샷이 아니라 전용 어댑터를 사용합니다.",
			},
			openDescriptions: {
				outline: "제품 결정과 현재 유효한 도메인 문서.",
				api: "애플리케이션, 통합, MCP를 위한 권한 기반 진입점.",
				github: "Rezics 생태계의 소스, Issue, 기여 진입점.",
			},
		},
		a11y: {
			skipContent: "주요 콘텐츠로 건너뛰기",
			primaryNavigation: "주요 내비게이션",
			mobileNavigation: "모바일 내비게이션",
			breadcrumb: "이동 경로",
			modes: "기능 모드",
		},
	},
} as const satisfies Record<AboutLocale, InterfaceCopy>;

export function getInterfaceCopy(locale: AboutLocale): InterfaceCopy {
	return INTERFACE_COPY[locale];
}
