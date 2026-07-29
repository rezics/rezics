import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { jaTerminology } from "@rezics/i18n/terminology/ja";

const { forms: postTerms } = jaTerminology.post;
const { forms: realmTerms } = jaTerminology.realm;
const { forms: zoneTerms } = jaTerminology.zone;

export default {
	workspace: {
		title: verbatimTerms.studio.value,
		description: "作成、管理、または管理担当として割り当てられたコンテンツを表示",
		backToApplication: `${verbatimTerms.rezics.value} に戻る`,
		navigation: `${verbatimTerms.studio.value} ナビゲーション`,
		overview: "コンテンツの種類",
		backToOverview: "コンテンツの種類に戻る",
	},
	sections: {
		book: { label: "書籍", description: "あなたの作業に関連する書籍を表示および管理" },
		software: {
			label: "ソフトウェア",
			description: "あなたの作業に関連するソフトウェアの項目を表示および管理します。",
		},
		media: {
			label: "メディア",
			description: "あなたの作業に関連するメディアを表示および管理します。",
		},
		entity: {
			label: "カタログのエントリー",
			description: "あなたの作業に関連するカタログの項目を表示および管理します。",
		},
		tag: { label: "タグ", description: "あなたの作業に関連するタグを表示および管理します。" },
		realm: {
			label: realmTerms.label,
			description: `あなたの作業に関連する${realmTerms.label}を表示および管理します。`,
		},
		zone: {
			label: zoneTerms.label,
			description: `あなたの作業に関連する${zoneTerms.label}を表示および管理します。`,
		},
		post: {
			label: postTerms.label,
			description: `あなたの作業に関連する${postTerms.label}を表示および管理します。`,
		},
		wiki: {
			label: "ウィキ記事",
			description: "あなたが管理しているウィキ記事を表示および管理します。",
		},
		collection: {
			label: "コレクション",
			description: "あなたの作業に関連するコレクションを表示および管理します。",
		},
		review: {
			label: "レビュー",
			description: "あなたの作業に関連するレビューを表示および管理します。",
		},
		poll: { label: "投票", description: "あなたの作業に関連する投票を表示および管理します。" },
	},
	realmTagContext: {
		label: `${realmTerms.label}タグ解説`,
		description: `この${realmTerms.label}におけるタグのウィキ解説を作成します。`,
	},
	list: {
		create: "作成",
		empty: "現在のフィルターに一致するコンテンツはありません。",
		untitled: "タイトルなしコンテンツ",
		contributionCount: insert("貢献 {{count}} 件", { count: Number }),
		activity: {
			visited: "閲覧",
			updated: "更新",
			created: "作成",
			relevant: "関連",
		},
	},
	filters: {
		viewLabel: "作業関係",
		permissionLabel: "現在の権限",
		workStateLabel: "作業状態",
		statusLabel: "コンテンツの状態",
		visibilityLabel: "表示状態",
		sortLabel: "並べ替え順",
		any: "すべて",
		more: "その他のフィルター",
		clear: "フィルターを解除",
		cancel: "キャンセル",
		apply: "フィルターを適用",
		views: {
			all: "私の作業",
			created: "私が作成",
			contributed: "私が貢献",
			assigned: "直接割り当て",
			delegated: "チームに委任",
		},
		permissions: {
			"unit.update": "編集可能",
			"unit.status.update": "ステータスを変更可能",
			"unit.access.manage": "アクセスを管理可能",
		},
		workStates: { actionable: "実行可能", blocked: "現在ブロック中" },
		statuses: { draft: "下書き", published: "公開", archived: "アーカイブ済み" },
		visibilities: { public: "公開", unlisted: "非公開", private: "プライベート" },
		sorts: {
			recent: "最近訪問した",
			updated: "最近更新された",
			created: "最近作成された",
			relevant: "最近関連性のある",
		},
	},
	relations: {
		created: "作成者",
		contributed: "貢献者",
		assigned: "直接割り当てられた",
		delegated: "チームに委任",
		blocked: "現在ブロック中",
	},
	developmentBadge: "開発中",
} satisfies typeof import("../zh-Hant/create").default;
