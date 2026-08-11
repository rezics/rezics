import { insert } from "native-i18n";

export default {
	title: "Direct messages",
	conversationWith: insert("Conversation with {{name}}", { name: String }),
	description: "Read and send messages in this private conversation.",
	unknownParticipant: "Unknown user",
	backToNotifications: "Back to notifications",
	loadOlder: "Load older messages",
	emptyTitle: "No messages yet",
	emptyDescription: "Send the first message to start this conversation.",
	deletedMessage: "This message was deleted.",
	you: "You",
	composeLabel: "Write a message",
	placeholder: "Type a message",
	send: "Send",
} satisfies typeof import("../zh-Hant/messages").default;
