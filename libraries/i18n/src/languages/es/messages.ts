import { insert } from "native-i18n";

export default {
	title: "Mensajes directos",
	conversationWith: insert("Conversación con {{name}}", { name: String }),
	description: "Lee y envía mensajes en esta conversación privada.",
	unknownParticipant: "Usuario desconocido",
	backToNotifications: "Volver a las notificaciones",
	loadOlder: "Cargar mensajes anteriores",
	emptyTitle: "Todavía no hay mensajes",
	emptyDescription: "Envía el primer mensaje para iniciar esta conversación.",
	deletedMessage: "Este mensaje se ha eliminado.",
	you: "Tú",
	composeLabel: "Escribir un mensaje",
	placeholder: "Escribe un mensaje",
	send: "Enviar",
} satisfies typeof import("../zh-Hant/messages").default;
