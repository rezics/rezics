import { insert } from "native-i18n";

export default {
	title: "Direktnachrichten",
	conversationWith: insert("Unterhaltung mit {{name}}", { name: String }),
	description: "Nachrichten in dieser privaten Unterhaltung lesen und senden.",
	unknownParticipant: "Unbekannte Person",
	backToNotifications: "Zurück zu den Benachrichtigungen",
	loadOlder: "Ältere Nachrichten laden",
	emptyTitle: "Noch keine Nachrichten",
	emptyDescription: "Sende die erste Nachricht, um diese Unterhaltung zu beginnen.",
	deletedMessage: "Diese Nachricht wurde gelöscht.",
	you: "Du",
	composeLabel: "Nachricht schreiben",
	placeholder: "Nachricht eingeben",
	send: "Senden",
} satisfies typeof import("../zh-Hant/messages").default;
