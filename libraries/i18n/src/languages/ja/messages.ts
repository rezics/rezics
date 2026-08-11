import { insert } from "native-i18n";

export default {
	title: "ダイレクトメッセージ",
	conversationWith: insert("{{name}}さんとの会話", { name: String }),
	description: "この非公開の会話でメッセージを確認、送信できます。",
	unknownParticipant: "不明なユーザー",
	backToNotifications: "通知に戻る",
	loadOlder: "以前のメッセージを読み込む",
	emptyTitle: "メッセージはまだありません",
	emptyDescription: "最初のメッセージを送信して会話を始めましょう。",
	deletedMessage: "このメッセージは削除されました。",
	you: "あなた",
	composeLabel: "メッセージを作成",
	placeholder: "メッセージを入力",
	send: "送信",
} satisfies typeof import("../zh-Hant/messages").default;
