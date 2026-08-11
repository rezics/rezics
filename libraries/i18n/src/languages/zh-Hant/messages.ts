import { insert } from "native-i18n";

export default {
	title: "私人訊息",
	conversationWith: insert("與 {{name}} 的對話", { name: String }),
	description: "在這個私人對話中查看與傳送訊息。",
	unknownParticipant: "未知的使用者",
	backToNotifications: "返回通知",
	loadOlder: "載入較早的訊息",
	emptyTitle: "目前沒有訊息",
	emptyDescription: "傳送第一則訊息來開始對話。",
	deletedMessage: "這則訊息已刪除。",
	you: "你",
	composeLabel: "撰寫訊息",
	placeholder: "輸入訊息",
	send: "傳送",
};
