import { insert } from "native-i18n";
import { jaTerminology } from "@rezics/i18n/terminology/ja";

const { forms: metadataTerms } = jaTerminology.metadata;

export default {
	title: "コレクション",
	favorites: "お気に入り",
	newCollection: "新しいコレクション",
	createDescription: "コンテンツの整理、提示、共有のためのコレクションを作成する。",
	editCollection: "コレクションを管理する",
	deleteCollection: "コレクションを削除する",
	deleteCollectionPrompt: "削除後、コレクションとその配置は復元できません。",
	emptyCollections: "まだコレクションはありません。",
	emptyCollectionTitle: "このコレクションは空です",
	emptyCollectionBody: "追加されたコンテンツは、フィードと同じカード形式でここに表示されます。",
	contentLabel: "コレクションのコンテンツ",
	itemCount: insert("{{count}} アイテム", { count: Number }),
	directCollectionHint:
		"コレクションは1つのアイテムとして追加されます。その内容は再帰的にインポートされません。",
	save: {
		action: "保存",
		title: "コレクションに保存",
		directDescription: "お気に入りまたは任意のカスタムコレクションを選択してください。",
		reviewDescription:
			"カスタムコレクションでは、レビューはレビュー対象の作品の下に配置されます。",
		favoritesDescription: "親子関係を作成せずに素早く保存できます。",
		searchLabel: "コレクションを探す",
		searchPlaceholder: "コレクション名を入力",
		noMatches: "一致するコレクションはありません。",
		noCollections: "コンテンツを受け入れることができるコレクションがまだありません。",
		createLabel: "コレクションを作成",
		createPlaceholder: "コレクション名",
		createAndSave: "作成して保存",
		manage: "コレクションを管理",
		saved: "保存済み",
		notSaved: "保存されていません",
	},
	workspace: {
		title: "コレクション管理",
		description: `コンテンツ、${metadataTerms.inline}、構造、表示、アクセス、履歴を管理します。`,
		navigation: "コレクション管理ナビゲーション",
		overview: "コレクション管理エリア",
		backToCollection: "コレクションに戻る",
		backToContent: "コンテンツに戻る",
		sections: {
			content: {
				label: "コンテンツ",
				description: "各コンテンツ言語でタイトル、概要、カバーを編集します。",
			},
			metadata: {
				label: metadataTerms.label,
				description: `状態と可視性 ${metadataTerms.inline} を設定するか、コレクションを削除します。`,
			},
			items: {
				label: "コンテンツと構造",
				description: "コンテンツを追加、削除、並べ替え、ネスト化、フィーチャーします。",
			},
			presentation: {
				label: "プレゼンテーション",
				description: "コンテンツのレイアウトと並び順ルールを選択します。",
			},
			access: {
				label: "アクセス",
				description: "認可対象、権限、制限を管理します。",
			},
			history: {
				label: "履歴",
				description: "コレクションの改訂版を確認、比較、復元します。",
			},
		},
	},
	items: {
		add: "コンテンツを追加",
		target: "コンテンツ",
		role: "役割",
		parent: "親項目",
		topLevel: "最上位",
		item: "標準項目",
		featured: "フィーチャー項目",
		remove: "削除",
		moveEarlier: "前に移動",
		moveLater: "後に移動",
		saveStructure: "構造を更新",
		empty: "このコレクションにはまだ管理可能なコンテンツはありません。",
	},
	presentation: {
		layout: "レイアウト",
		order: "並び順",
		save: "プレゼンテーションを保存",
		layouts: {
			flat: "シングルカラムフィード",
			nested: "親子グループ",
			shelf: "カードシェルフ",
		},
		orders: {
			manual: "手動順序",
			name: "名前",
			"added-at": "追加日",
		},
	},
	form: {
		language: "コンテンツ言語",
		title: "タイトル",
		summary: "サマリー",
		cover: "カバー",
		status: "ステータス",
		visibility: "表示状態",
		save: "変更を保存",
	},
	cancel: "キャンセル",
	delete: "削除",
	close: "閉じる",
} satisfies typeof import("../zh-Hant/collections").default;
