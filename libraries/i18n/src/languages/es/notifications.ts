import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { esTerminology } from "@rezics/i18n/terminology/es";

const { forms: followTerms } = esTerminology.follow;
const { forms: realmTerms } = esTerminology.realm;

export default {
	center: {
		title: "Notificaciones",
		description:
			"Revisa la actividad reciente y las actualizaciones del sistema que requieran tu atención.",
		headerLabel: "Notificaciones",
		headerUnreadLabel: insert("Notificaciones, {{count}} sin leer", { count: Number }),
		receivedInvitations: "Invitaciones de acceso recibidas",
		invitationsDescription:
			"Revisa y responde a las invitaciones de otras personas para acceder a una Unit.",
		backToNotifications: "Volver a las notificaciones",
		markAllRead: "Marcar todo como leído",
		markRead: "Marcar como leída",
		loadMore: "Cargar más notificaciones",
		unread: "Sin leer",
		emptyTitle: "Todavía no hay notificaciones",
		emptyDescription: "La actividad nueva y las actualizaciones del sistema aparecerán aquí.",
	},
	reply: {
		title: `Nueva respuesta en ${verbatimTerms.rezics.value}`,
		body: "Alguien ha respondido a una conversación en la que participas.",
	},
	new_follower: {
		title: `Nuevo ${followTerms.follower} en ${verbatimTerms.rezics.value}`,
		body: `Una persona te ha empezado a ${followTerms.action}.`,
	},
	direct_message: {
		title: `Nuevo mensaje en ${verbatimTerms.rezics.value}`,
		body: "Has recibido un nuevo mensaje directo.",
	},
	moderation: {
		title: `Actualización de moderación de ${verbatimTerms.rezics.value}`,
		body: "El estado de moderación de tu contenido ha cambiado.",
	},
	report_resolution: {
		title: `Decisión sobre una denuncia de ${verbatimTerms.rezics.value}`,
		body: "Se ha tomado una decisión sobre una denuncia que enviaste.",
	},
	realm: {
		title: `Actualización de un ${realmTerms.inline} en ${verbatimTerms.rezics.value}`,
		body: `Algo ha cambiado en uno de los ${realmTerms.plural} a los que perteneces.`,
	},
	system: {
		title: `Notificación del sistema de ${verbatimTerms.rezics.value}`,
		body: "Has recibido una notificación del sistema.",
	},
	unit_access_invitation: {
		title: "Nueva invitación de acceso",
		body: "Alguien te ha invitado a acceder a una Unit. Revisa la invitación antes de responder.",
	},
} satisfies typeof import("../zh-Hant/notifications").default;
