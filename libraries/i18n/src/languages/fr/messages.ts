import { insert } from "native-i18n";

export default {
	title: "Messages directs",
	conversationWith: insert("Conversation avec {{name}}", { name: String }),
	description: "Consultez et envoyez des messages dans cette conversation privée.",
	unknownParticipant: "Utilisateur inconnu",
	backToNotifications: "Retour aux notifications",
	loadOlder: "Charger les messages précédents",
	emptyTitle: "Aucun message pour le moment",
	emptyDescription: "Envoyez le premier message pour commencer cette conversation.",
	deletedMessage: "Ce message a été supprimé.",
	you: "Vous",
	composeLabel: "Écrire un message",
	placeholder: "Saisissez un message",
	send: "Envoyer",
} satisfies typeof import("../zh-Hant/messages").default;
