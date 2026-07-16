const content = {
	nav: {
		products: "プロダクト",
		platform: "プラットフォーム",
		history: "History",
		docs: "ドキュメント",
		github: "GitHub",
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
		documentation: "Outline ドキュメント",
		sourceCode: "ソースコード",
		relatedProducts: "関連プロダクト",
		usedCapabilities: "利用する共有機能",
		noParent: "親となるプロダクトを持たない独立機能",
		parentProduct: "親プロダクト",
		sourceBasis: "情報源",
	},
	footer: {
		statement:
			"Rezics はコンテンツの同一性、構造、履歴を中心にしたオープンなプロダクト体系です。",
		productLinks: "プロダクト",
		platformLinks: "プラットフォーム",
		openLinks: "オープン",
	},
	notFound: {
		title: "ページが見つかりません",
		body: "リンクが移動したか、まだ公開されていません。",
		back: "ホームへ戻る",
	},
	a11y: {
		skipContent: "メインコンテンツへ移動",
		primaryNavigation: "メインナビゲーション",
		mobileNavigation: "モバイルナビゲーション",
		breadcrumb: "パンくずリスト",
		modes: "機能モード",
	},
} satisfies typeof import("../en/common").default;

export default content;
