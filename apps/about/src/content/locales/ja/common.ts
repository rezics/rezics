import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	siteName: verbatimTerms.rezics.value,
	nav: {
		products: "プロダクト",
		platform: "プラットフォーム",
		history: "History",
		docs: "ドキュメント",
		github: verbatimTerms.github.value,
		language: "言語",
		theme: "テーマ",
		openMenu: "メニューを開く",
		closeMenu: "メニューを閉じる",
	},
	theme: {
		light: "ライト",
		dark: "ダーク",
		toggle: "配色テーマを切り替える",
	},
	status: {
		implemented: "実装済み",
		documented: "設計確認済み",
		planned: "計画中",
		research: "調査中",
	},
	classes: {
		surface: "プロダクト",
		capability: "共有機能",
		manifestation: "プロダクト形態",
		protocol: "内部プロトコル",
	},
	labels: {
		conceptPreview: "コンセプトプレビュー",
		conceptCaption: "同じサイズの実画面に差し替えられる、コードで作成したプロダクト展示です。",
		viewProduct: "プロダクトを見る",
		viewAll: "すべて見る",
		learnMore: "詳しく見る",
		documentation: `${verbatimTerms.outline.value} ドキュメント`,
		sourceCode: "ソースコード",
		relatedProducts: "関連プロダクト",
		usedCapabilities: "利用する共有機能",
		noParent: "親となるプロダクトを持たない独立機能",
		parentProduct: "親プロダクト",
		sourceBasis: "情報源",
	},
	footer: {
		statement: `${verbatimTerms.rezics.value} はコンテンツの同一性、構造、履歴を中心にしたオープンなプロダクト体系です。`,
		productLinks: "プロダクト",
		platformLinks: "プラットフォーム",
		openLinks: "オープン",
		implementation: `${verbatimTerms.agpl30.value} · ${verbatimTerms.vike.value} と ${verbatimTerms.react.value} で構築した静的サイト`,
	},
	notFound: {
		title: "ページが見つかりません",
		body: "リンクが移動したか、まだ公開されていません。",
		back: "ホームへ戻る",
	},
	a11y: {
		home: `${verbatimTerms.rezics.value} ホーム`,
		skipContent: "メインコンテンツへ移動",
		primaryNavigation: "メインナビゲーション",
		mobileNavigation: "モバイルナビゲーション",
		breadcrumb: "パンくずリスト",
		modes: "機能モード",
	},
} satisfies typeof import("../en/common").default;

export default content;
