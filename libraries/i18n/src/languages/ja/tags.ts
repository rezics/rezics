import { insert } from "native-i18n";

import { jaTerminology } from "@rezics/i18n/terminology/ja";

const { forms: realmTerms } = jaTerminology.realm;
const { forms: followTerms } = jaTerminology.follow;
const { forms: tagStructureTerms } = jaTerminology.tagStructure;

export default {
	page: {
		title: "タグ",
		description: "選択したタグ情報源によるグローバルタグと文脈に基づいた判定を確認",
		viewAll: "タグページ全体を表示",
		manageOnTagPage: `専用タグページでタグと ${tagStructureTerms.pluralLabel} を追加すると、投票コンテキストを表示したままにできます。`,
	},
	card: {
		open: insert("{{tag}} タグカードを開く ({{context}})", {
			tag: String,
			context: String,
		}),
		close: "タグカードを閉じる",
		globalContext: "グローバルタグ",
		structureContext: tagStructureTerms.label,
		policy: `${realmTerms.label}-セット`,
		search: "このタグを検索",
		details: "タグの詳細を表示",
	},
	selection: {
		start: "複数選択",
		finish: "選択を完了",
		add: "選択に追加",
		remove: "選択から削除",
		addNamed: insert("{{tag}} を選択", { tag: String }),
		removeNamed: insert("{{tag}} の選択を解除", { tag: String }),
		selectedCount: insert("{{count}} タグが選択されました", { count: Number }),
		search: "選択されたタグを検索",
		clear: "選択をクリア",
	},
	basic: {
		title: "基本タグ",
		description: `グローバルタグおよび${tagStructureTerms.pluralLabel}、いかなる${realmTerms.label}による文脈判断なし。`,
	},
	structures: {
		title: tagStructureTerms.pluralLabel,
		description: `${tagStructureTerms.pluralLabel}は意味のある階層を保持し、フラットタグの前に表示されます。`,
		addTitle: `${tagStructureTerms.inline}を追加`,
		addDescription: `まず承認された${tagStructureTerms.plural}を検索します。追加することでパスおよびその上のすべてのタグをサポートします。`,
		add: `${tagStructureTerms.label}を追加`,
		create: `${tagStructureTerms.label} を作成`,
		details: `${tagStructureTerms.label}を見る`,
		empty: `この作品にはまだ承認された${tagStructureTerms.plural}がありません。`,
		memberFallback: "名前のないタグ",
		pathLabel: `順序付き${tagStructureTerms.label}`,
	},
	detail: {
		childrenTitle: "直接の子タグ",
		childrenDescription: `これらの関係は、承認されたコミュニティロック中の${tagStructureTerms.pluralLabel}から来ています。各子は自身の直接の子を表示します。`,
		noChildren: "このタグにはまだ承認された直接の子タグがありません。",
		grandchildrenTitle: "直接の子",
	},
	createStructure: {
		title: `${tagStructureTerms.label} を作成`,
		description:
			"より広範なタグからより具体的なタグへの順序付きパスを作成します。作成後、コミュニティメンバーは編集できません；プラットフォーム管理者は監査された修正を行うことがあります。",
		pick: "次のタグを選択",
		addMember: "パスに追加",
		removeMember: "パスから削除",
		moveEarlier: "前に移動",
		moveLater: "後に移動",
		preview: "コミュニティロック中のパスプレビュー",
		minimum: "少なくとも2つ以上の異なるタグを追加してください。",
		submit: `${tagStructureTerms.label}を作成して投票する`,
	},
	adminEditStructure: {
		title: `${tagStructureTerms.label}を修正する`,
		description:
			"プラットフォームの管理者はメンバーや順序を修正できます。ユニットの識別、投票、申請は保持され、修正は履歴に記録されます。",
		reasonLabel: "修正理由",
		reasonPlaceholder: "この管理者による修正が必要な理由を説明してください。",
		submit: "監査された修正を保存する",
	},
	global: {
		title: "グローバルタグ",
		description:
			"グローバルタグは、インタラクションアクセスを持つ全員によって提案され、判断されます。",
		addTitle: "グローバルタグを追加する",
		addDescription:
			"まず既存のタグを検索してください。追加すると同時に「適合」投票も行われます。",
		add: "タグを追加する",
		pinned: "固定済み",
		empty: "この作品にはまだグローバルタグがありません。",
	},
	management: {
		title: "タグの選定",
		description:
			"最初に表示するグローバルタグを選びます。その他のタグはコミュニティ順位を維持します。",
		featuredTitle: "注目タグ",
		featuredDescription:
			"注目タグは設定した順序で最初に表示されます。ドラッグするか移動ボタンを使用してください。",
		rankedTitle: "コミュニティ順のタグ",
		rankedDescription: "その他のグローバルタグは、コミュニティ投票に基づいて自動的に並びます。",
		feature: "注目タグにする",
		unfeature: "注目を解除",
		moveEarlier: "前へ移動",
		moveLater: "後ろへ移動",
		drag: insert("{{tag}} をドラッグして並べ替え", { tag: String }),
		instructions:
			"スペースキーで注目タグを持ち上げ、矢印キーで移動し、もう一度スペースキーを押して置きます。",
		pickedUp: insert("{{tag}} を持ち上げました。", { tag: String }),
		over: insert("{{tag}} は全 {{count}} 件中 {{position}} 番目の位置にあります。", {
			tag: String,
			position: Number,
			count: Number,
		}),
		cancelled: insert("{{tag}} の移動をキャンセルしました。", { tag: String }),
		featuredAnnouncement: insert("{{tag}} を {{position}} 番目の注目タグにしました。", {
			tag: String,
			position: Number,
		}),
		unfeaturedAnnouncement: insert("{{tag}} の注目を解除しました。", { tag: String }),
		movedAnnouncement: insert("{{tag}} を {{position}} 番目に移動しました。", {
			tag: String,
			position: Number,
		}),
		noFeatured: "注目タグはまだありません。",
		noRanked: "注目タグにできる他のグローバルタグはありません。",
	},
	realms: {
		title: `${realmTerms.label} タグの文脈`,
		description: `各${realmTerms.inline}は独立した文脈です。その判断はグローバルタグや他の${realmTerms.inline}と統合されることはありません。`,
		policy: `${realmTerms.label}-設定タグ`,
		votes: `${realmTerms.label}メンバーの投票`,
		context: "投票文脈を表示",
		empty: "あなたが選択したタグのソースはまだこの作品を判断していません。",
		cannotVote: `この${realmTerms.inline}に参加して、そのコンテキスト投票に参加してください。`,
	},
	vote: {
		fits: "適合",
		doesNotFit: "不適合",
		clear: "自分の判定を削除",
		signIn: "投票するにはサインイン",
		signInDescription: "グローバルタグコンテキストで投票するにはサインイン",
		summary: insert("得票差 {{score}}・{{count}} 票", {
			score: String,
			count: String,
		}),
	},
	sources: {
		title: "タグソース",
		description: `作業タグ画面に表示される${realmTerms.plural}を選んで順序付けします。これは作品を${followTerms.action}したり、${realmTerms.inline}のメンバーシップを変更することではありません。`,
		addTitle: "タグソースを追加",
		addDescription: `読み取り可能な${realmTerms.plural}を検索し、個人のタグソースリストに追加`,
		add: "ソースを追加",
		remove: "ソースを削除",
		moveEarlier: "前に移動",
		moveLater: "後に移動",
		empty: "選択されたタグソースがありません",
		manage: "タグソースを管理",
	},
	unnamedTag: "名前のないタグ",
	unnamedRealm: `名前なし ${realmTerms.label}`,
	unnamedStructure: `名前なし ${tagStructureTerms.label}`,
} satisfies typeof import("../zh-Hant/tags").default;
