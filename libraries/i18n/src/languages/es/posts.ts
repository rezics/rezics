import { esTerminology } from "@rezics/i18n/terminology/es";

const { forms: postTerms } = esTerminology.post;
const { forms: realmTerms } = esTerminology.realm;

export default {
	title: postTerms.pluralLabel,
	create: `Nueva ${postTerms.inline}`,
	createTitle: `Publicar una ${postTerms.inline}`,
	editTitle: `Editar la ${postTerms.inline}`,
	publish: "Publicar",
	untitled: `${postTerms.label} sin título`,
	unknownAttribution: "Sin atribución",
	publisher: "Editorial",
	replies: `${postTerms.pluralLabel} de respuesta`,
	replyPost: `${postTerms.label} de respuesta`,
	signInToReply: "Inicia sesión para responder",
	openReplyComposer: "Participar en la conversación",
	hideChildReplies: "Ocultar respuestas posteriores",
	showChildReplies: "Mostrar respuestas posteriores",
	replyingLocked: `Se han desactivado las nuevas ${postTerms.plural} de respuesta para este destino.`,
	noReplies: `Todavía no hay ${postTerms.plural} de respuesta.`,
	replyBody: "Contenido de la respuesta",
	reply: "Responder",
	cancel: "Cancelar",
	delete: "Eliminar",
	deleteTitle: `¿Eliminar la ${postTerms.inline}?`,
	deleteDescription: "Esta acción no se puede deshacer.",
	deleteReplyTitle: `¿Eliminar la ${postTerms.inline} de respuesta?`,
	deleteReplyDescription: "El contenido de la respuesta dejará de mostrarse.",
	deletedReply: `Esta ${postTerms.inline} de respuesta se ha eliminado.`,
	editReplyTitle: `Editar la ${postTerms.inline} de respuesta`,
	viewThread: "Ver la conversación completa",
	history: "Historial",
	historyTitle: "Historial de versiones",
	noRevisions: "Todavía no hay versiones.",
	currentRevision: "Versión actual",
	minorEdit: "Edición menor",
	hiddenRevision: "Oculta",
	undoRevision: "Deshacer esta edición",
	restoreRevision: "Restaurar esta versión",
	compareWithParent: "Comparar con la versión anterior",
	revisionBy: "Persona editora",
	noEditSummary: "Sin resumen de edición",
	compareTitle: "Diferencias entre versiones",
	before: "Antes",
	after: "Después",
	realm: realmTerms.label,
	selectRealmContext: `Seleccionar el ${realmTerms.inline} de contexto`,
	realmContextCard: `Información del ${realmTerms.inline}`,
	subject: "Tema",
	clearRealm: `Quitar el ${realmTerms.inline}`,
	clearSubject: "Quitar el tema",
	attributions: "Créditos",
	viewRealm: `Ver el ${realmTerms.inline}`,
	workspace: {
		description:
			"Edita el contenido principal, las relaciones de atribución, el acceso y el historial de versiones.",
		backToContent: "Volver al contenido",
		navigation: "Navegación de gestión de contenido",
		sections: {
			main: {
				label: "Contenido principal",
				postDescription: `Edita el título y el contenido de la ${postTerms.inline}.`,
				replyDescription: `Edita el contenido de la ${postTerms.inline} de respuesta.`,
				reviewDescription:
					"Edita el título, el resumen, el contenido y la puntuación asociados a la reseña.",
			},
			attributions: {
				label: "Relaciones de atribución",
				description:
					"Revisa las atribuciones actuales y gestiona las propuestas que debe aceptar la otra parte.",
			},
		},
		currentAttributions: "Atribuciones actuales",
		currentAttributionsDescription:
			"Relaciones de atribución establecidas que se muestran en este contenido.",
	},
} satisfies typeof import("../zh-Hant/posts").default;
