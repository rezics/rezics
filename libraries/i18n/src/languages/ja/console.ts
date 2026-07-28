import { insert } from "native-i18n";

import { jaTerminology } from "@rezics/i18n/terminology/ja";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: realmTerms } = jaTerminology.realm;

export default {
	title: "管理コンソール",
	description:
		"プラットフォームの機能は各管理分野を解放します; これはユーザーの身元や雇用関係を示すものではありません。",
	backToApplication: "アプリケーションに戻る",
	navigation: "管理コンソールのナビゲーション",
	overview: "すべての管理分野",
	cancel: "キャンセル",
	sections: {
		access: {
			label: "プラットフォームアクセス",
			description:
				"プロファイルに付与されたプラットフォーム機能を確認または管理します。各付与の期限や由来を含みます。",
		},
		audit: {
			label: "セキュリティ監査",
			description: `プラットフォーム、${realmTerms.pluralLabel}、およびユニット全体での影響の大きい管理イベントとセキュリティに関する決定を確認します。`,
		},
	},
	access: {
		searchTitle: "プロファイルを探す",
		searchLabel: "名前またはサインイン用メール",
		searchPlaceholder: "名前またはメールを入力",
		search: "検索",
		searchResults: "検索結果",
		activeProfiles: "アクティブなプラットフォームアクセスを持つプロファイル",
		noProfiles: "アクティブなプラットフォーム機能の付与はありません。",
		noSearchResults: "一致するプロファイルは見つかりませんでした。",
		selectProfile: "プロファイルを選択して、そのプラットフォームアクセスを確認します。",
		capabilityCount: insert("{{count}} の機能", { count: Number }),
		capability: "機能",
		expiry: "期限",
		expiryFor: insert("{{capability}} の期限", { capability: String }),
		noExpiry: "期限なし",
		provenance: "権限の由来",
		grantProvenance: insert("{{date}} に {{profileId}} が付与", {
			profileId: String,
			date: String,
		}),
		notGranted: "直接付与されていません",
		readOnly: "プラットフォームアクセスを確認できますが、変更はできません。",
		grantAll: "すべての権限を付与",
		clearAll: "すべての権限をクリア",
		save: "プラットフォームアクセスを保存",
		revokeAllTitle: "このプロファイルからすべてのプラットフォームアクセスを取り消しますか？",
		revokeAllDescription:
			"これにより、すべてのアクティブな付与が取り消されます。最後の期限なしプラットフォームアクセス管理者を削除する場合、サーバーは変更を拒否します。",
		confirmRevokeAll: "完全な取り消しを確認",
	},
	audit: {
		category: "イベントカテゴリ",
		allCategories: "すべてのカテゴリ",
		categories: {
			admin_activity: "管理活動",
			policy_denied: "ポリシーによる拒否",
			system_event: "システムイベント",
		},
		outcome: "結果",
		allOutcomes: "すべての結果",
		outcomes: {
			succeeded: "成功",
			denied: "拒否",
			failed: "失敗",
		},
		time: "時間",
		action: "操作",
		actor: "実行者",
		authority: "権限",
		authorities: {
			platform: "プラットフォーム",
			realm: realmTerms.label,
			unit: "ユニット",
		},
		empty: "現在のフィルターに一致する監査イベントはありません。",
		previousPage: "前のページ",
		nextPage: "次のページ",
		selectEvent: "イベントを選択して、完全な監査記録を確認してください。",
		detailsTitle: "イベントの詳細",
		systemActor: "システム",
		credential: "資格情報の種類",
		credentialId: `資格情報 ${verbatimTerms.id.value}`,
		credentials: {
			session: "インタラクティブセッション",
			api_token: `${verbatimTerms.api.value} トークン`,
			bootstrap: "システムブートストラップ",
			system: "システムプロセス",
		},
		scopedAuthority: insert("{{kind}} ({{id}})", { kind: String, id: String }),
		target: "対象",
		noTarget: "特定の対象なし",
		reasonCode: "理由コード",
		requestId: `リクエスト ${verbatimTerms.id.value}`,
		traceId: `トレース ${verbatimTerms.id.value}`,
		rawDetails: "構造化された詳細",
	},
} satisfies typeof import("../zh-Hant/console").default;
