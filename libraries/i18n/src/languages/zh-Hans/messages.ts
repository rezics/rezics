import { insert } from "native-i18n";

export default {
	title: "私人消息",
	conversationWith: insert("与 {{name}} 的对话", { name: String }),
	description: "在这个私人对话中查看和发送消息。",
	unknownParticipant: "未知用户",
	backToNotifications: "返回通知",
	loadOlder: "加载更早的消息",
	emptyTitle: "当前没有消息",
	emptyDescription: "发送第一则消息以开始对话。",
	deletedMessage: "这则消息已删除。",
	you: "你",
	composeLabel: "撰写消息",
	placeholder: "输入消息",
	send: "发送",
} satisfies typeof import("../zh-Hant/messages").default;
