import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { jaTerminology } from "@rezics/i18n/terminology/ja";

const { forms: postTerms } = jaTerminology.post;
const { forms: realmTerms } = jaTerminology.realm;
const { forms: entityTerms } = jaTerminology.entity;
const { forms: zoneTerms } = jaTerminology.zone;

export default {
	workspace: {
		title: verbatimTerms.studio.value,
		description: "現在編集できるコンテンツと、これまで参加した公開編集を確認できます。",
		backToApplication: `${verbatimTerms.rezics.value} に戻る`,
		navigation: `${verbatimTerms.studio.value} ナビゲーション`,
		overview: "コンテンツの種類",
		backToOverview: "コンテンツの種類に戻る",
	},
	mode: {
		label: "コンテンツ一覧",
		options: {
			workspace: "あなたのワークスペース",
			contributions: "あなたの貢献",
		},
	},
	lifecycle: {
		configurable: "所有形態と公開範囲を選択",
		publish_now: "作成時に公開",
		private_first: "作成時は非公開",
		immutable: "変更不可の定義",
		preview: "プレビュー機能",
	},
	entityHelp: {
		label: "クレジットの説明を開く",
		title: "クレジットの説明",
		description: `クレジットには${entityTerms.inline}が必要です。${entityTerms.inline}が見つからない場合や、例えば自分自身を著者として登録したい場合は、先に${entityTerms.inline}を作成してください。`,
		createEntity: `${entityTerms.label}を作成`,
		close: "閉じる",
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
			label: entityTerms.pluralLabel,
			description: `あなたの作業に関連する${entityTerms.plural}を表示および管理します。`,
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
	communityUnitSearch: {
		policyTitle: "作成前に検索してください",
		policy:
			"良好なコミュニティ環境を維持するため、公開項目を作成する前に検索し、作成したい内容がまだ存在しないことを確認してください。公開項目の作成機能を悪用した場合、処分の対象となることがあります。",
		confirmationLabel: insert(
			"既存の{{subject}}を調べ、この項目がまだ存在しないことを確認しました。",
			{ subject: String },
		),
		prompt: insert("既存の{{subject}}を検索", { subject: String }),
		pageTitle: insert("既存の{{subject}}を検索", { subject: String }),
		pageDescription: insert("作成したい{{subject}}がすでに存在するか確認します。", {
			subject: String,
		}),
		backToSection: insert("{{subject}}に戻る", { subject: String }),
		searchLabel: insert("{{subject}}を検索", { subject: String }),
		searchPlaceholder: insert("{{subject}}の名前を入力", { subject: String }),
		searchAction: "検索",
		searchHint: "名前を入力して、既存の可能性がある項目を検索してください。",
		searchFailed: "検索は一時的に利用できません。再試行するか、作成フォームに戻ってください。",
		resultsTitle: "既存の可能性がある項目",
		noResultsTitle: insert("一致する{{subject}}が見つかりません", { subject: String }),
		noResultsDescription: "検索語が正しいことを確認したうえで、作成に進むことができます。",
		realmTagContextOnly: `ここには、この${realmTerms.label}が正式に説明しているタグだけが表示されます。タグがない場合は、先に${realmTerms.label}の管理者がタグ説明を作成してください。`,
		notListedTitle: "どの検索結果にも該当しませんか？",
		notListedDescription:
			"類似する項目を先に確認し、該当するものがない場合のみ新規作成に進んでください。",
		createAction: "作成に進む",
		subjects: {
			book: "書籍",
			software: "ソフトウェア",
			media: "メディア",
			person: "人物",
			organization: "組織",
			character: "キャラクター",
			tag: "タグ",
		},
	},
	list: {
		create: "作成",
		empty: {
			workspace: "現在の絞り込み条件に一致する編集可能なコンテンツはありません。",
			contributions: "現在の絞り込み条件に一致する公開の貢献はありません。",
		},
		untitled: "タイトルなしコンテンツ",
		immutable: "変更不可",
		contributionCount: insert("貢献 {{count}} 件", { count: Number }),
		activity: {
			visited: "閲覧",
			assigned: "割り当て",
			created: "作成",
			participated: "編集に参加",
		},
	},
	filters: {
		sourceLabel: "ワークスペースの取得元",
		kindLabel: "貢献の種類",
		statusLabel: "コンテンツの状態",
		visibilityLabel: "表示状態",
		any: "すべて",
		more: "その他のフィルター",
		clear: "フィルターを解除",
		cancel: "キャンセル",
		apply: "フィルターを適用",
		sources: {
			all: "すべての編集可能なコンテンツ",
			owned: "自分が所有",
			direct: "直接割り当て",
			delegated: "チームから委任",
		},
		kinds: {
			all: "すべての貢献",
			created: "自分が作成",
			contributed: "自分が編集",
		},
		statuses: { draft: "下書き", published: "公開", archived: "アーカイブ済み" },
		visibilities: { public: "公開", unlisted: "非公開", private: "プライベート" },
	},
	relations: {
		owner: "所有者",
		direct: "直接割り当て",
		realm: "チームから委任",
		created: "作成者",
		contributed: "貢献者",
	},
	developmentBadge: "開発中",
} satisfies typeof import("../zh-Hant/create").default;
