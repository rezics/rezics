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
	followingSettings: {
		triggerEnabled: `Abrir los ajustes de notificaciones del ${followTerms.gerund}; las notificaciones internas están activadas`,
		triggerDisabled: `Abrir los ajustes de notificaciones del ${followTerms.gerund}; las notificaciones internas están desactivadas`,
		title: `Ajustes de notificaciones del ${followTerms.gerund}`,
		description:
			"Elige las notificaciones internas y las fuentes de personalización para esta Unit seguida.",
		inAppTitle: "Notificaciones internas",
		inAppDescription:
			"Mostrar en el centro de notificaciones las actualizaciones compatibles de esta Unit seguida.",
		realmTagSourceTitle: `Cargar los votos de Tags de este ${realmTerms.inline}`,
		realmTagSourceDescription: `Añade este ${realmTerms.inline} a tus fuentes de Tags y muestra los resultados de sus votos de Tags en las páginas de detalles de las Units. Este ajuste no crea notificaciones.`,
		unfollowKeepsRealmTagSource: `${followTerms.undoActionLabel} no elimina este ${realmTerms.inline} de tus fuentes de Tags.`,
		cancel: "Cancelar",
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
	unit_ownership_override: {
		title: "Titularidad de la Unit modificada",
		body: "La administración de la plataforma ha cambiado la titularidad de una Unit vinculada a tu perfil.",
	},
} satisfies typeof import("../zh-Hant/notifications").default;
