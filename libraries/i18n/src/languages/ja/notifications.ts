import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { jaTerminology } from "@rezics/i18n/terminology/ja";

const { forms: followTerms } = jaTerminology.follow;
const { forms: realmTerms } = jaTerminology.realm;

export default {
	center: {
		title: "通知",
		description: "あなたの注意が必要な最近のアクティビティとシステム更新を確認。",
		headerLabel: "通知",
		headerUnreadLabel: insert("通知、{{count}} 未読", { count: Number }),
		receivedInvitations: "受け取ったアクセス招待",
		invitationsDescription: "他の人から送られたユニットアクセスの招待を確認して応答。",
		backToNotifications: "通知に戻る",
		markAllRead: "すべて既読にする",
		markRead: "既読にする",
		loadMore: "さらに通知を読み込む",
		unread: "未読",
		emptyTitle: "通知はまだありません",
		emptyDescription: "新しいアクティビティとシステム更新がここに表示されます。",
	},
	reply: {
		title: `${verbatimTerms.rezics.value} に新しい返信`,
		body: "参加した会話に誰かが返信しました。",
	},
	new_follower: {
		title: `${verbatimTerms.rezics.value} に新しい ${followTerms.follower}`,
		body: `誰かがあなたに ${followTerms.gerund} を始めました。`,
	},
	direct_message: {
		title: `${verbatimTerms.rezics.value} に新しいメッセージ`,
		body: "新しいダイレクトメッセージを受け取りました。",
	},
	moderation: {
		title: `${verbatimTerms.rezics.value} のモデレーション更新`,
		body: "コンテンツのモデレーション状況が変更されました。",
	},
	realm: {
		title: `${verbatimTerms.rezics.value} ${realmTerms.label} の更新`,
		body: `所属している ${realmTerms.inline} に何か変更がありました。`,
	},
	system: {
		title: `${verbatimTerms.rezics.value} システム通知`,
		body: "システム通知を受け取りました。",
	},
	unit_access_invitation: {
		title: "新しいアクセス招待",
		body: "誰かがあなたをユニットに招待しました。返信する前に招待を確認してください。",
	},
} satisfies typeof import("../zh-Hant/notifications").default;
