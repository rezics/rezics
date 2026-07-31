import { insert } from "native-i18n";

import { esTerminology } from "@rezics/i18n/terminology/es";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: realmTerms } = esTerminology.realm;
const { forms: followTerms } = esTerminology.follow;
const { forms: postTerms } = esTerminology.post;
const { forms: tagStructureTerms } = esTerminology.tagStructure;

export default {
	page: {
		title: "Etiquetas",
		description:
			"Revisa las etiquetas globales y las valoraciones contextuales de las fuentes de etiquetas que hayas seleccionado.",
		viewAll: "Ver la página completa de la etiqueta",
		manageOnTagPage: `Añade etiquetas y ${tagStructureTerms.plural} en la página específica de etiquetas para que su contexto de votación siga visible.`,
	},
	card: {
		open: insert("Abrir la tarjeta de la etiqueta {{tag}} ({{context}})", {
			tag: String,
			context: String,
		}),
		close: "Cerrar la tarjeta de la etiqueta",
		globalContext: "Contexto global",
		structureContext: tagStructureTerms.label,
		policy: `Definida por el ${realmTerms.inline}`,
		search: "Buscar esta etiqueta",
		details: "Ver detalles de la etiqueta",
	},
	selection: {
		start: "Seleccionar varias",
		finish: "Terminar la selección",
		add: "Añadir a la selección",
		remove: "Quitar de la selección",
		addNamed: insert("Seleccionar {{tag}}", { tag: String }),
		removeNamed: insert("Anular la selección de {{tag}}", { tag: String }),
		selectedCount: insert("{{count}} etiquetas seleccionadas", { count: Number }),
		search: "Buscar entre las etiquetas seleccionadas",
		clear: "Borrar selección",
	},
	basic: {
		title: "Etiquetas básicas",
		description: `Etiquetas globales y ${tagStructureTerms.plural}, sin valoraciones contextuales de ningún ${realmTerms.inline}.`,
	},
	voteContext: {
		title: "Votar por contexto",
		description: `Elige el contexto global o un ${realmTerms.label} en el que puedas participar. La lista, los resultados y tus votos usarán ese contexto.`,
		select: "Elegir un contexto de votación",
	},
	details: {
		title: "Otros contextos de etiquetas",
		description: `Las etiquetas globales y tus fuentes de ${realmTerms.label} conservan sus propios contextos. El contexto de votación activo no se repite aquí.`,
		empty: "No hay otras fuentes de etiquetas seleccionadas.",
	},
	structures: {
		title: tagStructureTerms.pluralLabel,
		description: `Las ${tagStructureTerms.plural} conservan una jerarquía con significado y se muestran antes que las etiquetas sin jerarquía.`,
		addTitle: `Añadir una ${tagStructureTerms.inline}`,
		addDescription: `Busca primero ${tagStructureTerms.plural} aceptadas. Añadir una respalda la ruta y todas sus etiquetas.`,
		add: `Añadir ${tagStructureTerms.inline}`,
		create: `Crear ${tagStructureTerms.inline}`,
		details: `Ver ${tagStructureTerms.inline}`,
		empty: `Esta obra todavía no tiene ninguna ${tagStructureTerms.inline} aceptada.`,
		memberFallback: "Etiqueta sin nombre",
		pathLabel: `${tagStructureTerms.label} ordenada`,
	},
	detail: {
		sections: "Pestañas de detalles de la etiqueta",
		tabs: {
			overview: "Resumen",
			discussion: "Debate",
			content: "Contenido relacionado",
			structure: "Jerarquía",
		},
		overviewTitle: "Descripción de la etiqueta",
		overviewDescription:
			"Lee la explicación completa de esta etiqueta. El resumen permanece visible en tarjetas y vistas previas.",
		bodyEmpty: "Esta etiqueta todavía no tiene una descripción detallada.",
		discussionTitle: "Debate",
		discussionDescription: `Crea ${postTerms.plural} sobre esta etiqueta y participa en los debates existentes.`,
		contentTitle: "Contenido relacionado",
		contentDescription: "Explora obras y otros contenidos que usan esta etiqueta.",
		structureTitle: "Jerarquía de la etiqueta",
		structureDescription:
			"Consulta dónde aparece esta etiqueta en estructuras aprobadas por la comunidad.",
		editTitle: "Editar el contenido de la etiqueta",
		editDescription:
			"Actualiza el título, el resumen y la descripción en el idioma de contenido actual.",
		editNavigation: "Gestión del contenido de la etiqueta",
		backToTag: "Volver a la etiqueta",
		backToEditOverview: "Volver al resumen de edición",
		childrenTitle: "Etiquetas subordinadas directas",
		childrenDescription: `Estas relaciones proceden de ${tagStructureTerms.plural} aceptadas y bloqueadas por la comunidad. Cada elemento subordinado muestra sus propios elementos subordinados directos.`,
		noChildren: "Esta etiqueta todavía no tiene elementos subordinados directos aceptados.",
		grandchildrenTitle: "Elementos subordinados directos",
	},
	createStructure: {
		title: `Crear ${tagStructureTerms.inline}`,
		description:
			"Crea una ruta ordenada desde las etiquetas más generales hasta las más específicas. Los miembros de la comunidad no podrán editarla después de crearla; los administradores de la plataforma podrán realizar correcciones auditadas.",
		pick: "Elegir la siguiente etiqueta",
		addMember: "Añadir a la ruta",
		removeMember: "Quitar de la ruta",
		moveEarlier: "Mover hacia el principio",
		moveLater: "Mover hacia el final",
		preview: "Vista previa de la ruta bloqueada por la comunidad",
		minimum: "Añade al menos dos etiquetas distintas.",
		submit: `Crear ${tagStructureTerms.inline} y votar`,
	},
	adminEditStructure: {
		title: `Corregir ${tagStructureTerms.inline}`,
		description:
			"Los administradores de la plataforma pueden corregir los elementos o su orden. Se conservan la identidad de la Unit, los votos y los usos, y la corrección queda registrada en el historial.",
		reasonLabel: "Motivo de la corrección",
		reasonPlaceholder: "Explica por qué es necesaria esta corrección administrativa.",
		submit: "Guardar la corrección auditada",
	},
	create: {
		noResults: insert("No se encontró ninguna etiqueta que coincida con «{{query}}».", {
			query: String,
		}),
		inStudio: insert(`Crear «{{query}}» en ${verbatimTerms.studio.value}`, {
			query: String,
		}),
		title: "Crear una etiqueta",
		description:
			"Crea una etiqueta global reutilizable después de comprobar las etiquetas existentes.",
		voteDescription:
			"Después de crearla, volverás a la obra y votarás «Encaja» en el contexto actual.",
		backToUnitTags: "Volver a las etiquetas de la obra",
		backToStudioTags: `Volver a Etiquetas en ${verbatimTerms.studio.value}`,
		submit: "Crear etiqueta",
		submitAndVote: "Crear etiqueta y votar «Encaja»",
		applying: "Etiqueta creada. Registrando tu voto…",
		partialTitle: "Etiqueta creada, voto no registrado",
		partialDescription:
			"La etiqueta se creó, pero no se pudo aplicar a la obra ni registrar tu voto. Puedes volver a intentarlo sin crear otra etiqueta.",
		retryVote: "Reintentar el voto",
		returnToUnitTags: "Volver a las etiquetas de la obra",
		completed: "Se creó la etiqueta y se registró tu voto «Encaja».",
	},
	global: {
		title: "Contexto global",
		description:
			"En el contexto global, la explicación de cada etiqueta procede de su propia ficha; todas las personas con acceso de interacción pueden participar en la valoración.",
		addTitle: "Añadir una etiqueta global",
		addDescription:
			"Busca primero entre las etiquetas existentes. Añadir una también cuenta como un voto «Encaja».",
		add: "Añadir etiqueta",
		pinned: "Fijada",
		empty: "Esta obra todavía no tiene etiquetas globales.",
	},
	management: {
		title: "Selección de etiquetas",
		addSectionTitle: "Añadir etiquetas",
		addSectionDescription:
			"Abre la página de etiquetas para buscar y aplicar etiquetas. Añadir y votar no requiere permiso de selección.",
		addSectionAction: "Añadir etiquetas",
		description:
			"Elige qué etiquetas globales aparecen primero. Las demás conservan el orden de la comunidad.",
		featuredTitle: "Etiquetas destacadas",
		featuredDescription:
			"Las etiquetas destacadas aparecen primero en el orden que definas. Arrástralas o usa los botones.",
		rankedTitle: "Etiquetas ordenadas por la comunidad",
		rankedDescription:
			"Las demás etiquetas globales se ordenan automáticamente según los votos de la comunidad.",
		feature: "Destacar",
		unfeature: "Quitar de destacadas",
		moveEarlier: "Mover antes",
		moveLater: "Mover después",
		drag: insert("Arrastrar {{tag}} para reordenar", { tag: String }),
		instructions:
			"Pulsa Espacio para recoger una etiqueta destacada. Muévela con las flechas y pulsa Espacio de nuevo para soltarla.",
		pickedUp: insert("Se ha recogido {{tag}}.", { tag: String }),
		over: insert("{{tag}} está sobre la posición {{position}} de {{count}}.", {
			tag: String,
			position: Number,
			count: Number,
		}),
		cancelled: insert("Se ha cancelado el movimiento de {{tag}}.", { tag: String }),
		featuredAnnouncement: insert("Se ha destacado {{tag}} en la posición {{position}}.", {
			tag: String,
			position: Number,
		}),
		unfeaturedAnnouncement: insert("Se ha quitado {{tag}} de las destacadas.", {
			tag: String,
		}),
		movedAnnouncement: insert("Se ha movido {{tag}} a la posición {{position}}.", {
			tag: String,
			position: Number,
		}),
		noFeatured: "Aún no hay etiquetas destacadas.",
		noRanked: "No hay más etiquetas globales que destacar.",
	},
	realms: {
		title: `Contextos de etiquetas de los ${realmTerms.plural}`,
		description: `Cada ${realmTerms.inline} es un contexto independiente. Sus valoraciones nunca se combinan con las etiquetas globales ni con otro ${realmTerms.inline}.`,
		addTitle: `Añadir un voto de etiqueta en este ${realmTerms.label}`,
		addDescription: `Busca primero entre las etiquetas existentes. Al añadir una, también votas «Encaja» en este ${realmTerms.inline}.`,
		add: "Añadir voto",
		policy: `Etiquetas definidas por el ${realmTerms.inline}`,
		votes: `Votos de los miembros del ${realmTerms.inline}`,
		empty: "Las fuentes de etiquetas seleccionadas todavía no han valorado esta obra.",
		cannotVote: `Únete a este ${realmTerms.inline} para participar en su votación contextual.`,
	},
	vote: {
		fits: "Encaja",
		doesNotFit: "No encaja",
		clear: "Quitar mi valoración",
		signIn: "Iniciar sesión para votar",
		signInDescription: "Inicia sesión para votar en el contexto global de etiquetas.",
		summary: insert("Saldo {{score}} · {{count}} votos", {
			score: String,
			count: String,
		}),
	},
	sources: {
		title: "Fuentes de etiquetas",
		description: `Elige y ordena los ${realmTerms.plural} que se muestran en las áreas de etiquetas de las obras. Esto no implica ${followTerms.action} una obra ni cambia tu pertenencia a un ${realmTerms.inline}.`,
		addTitle: "Añadir una fuente de etiquetas",
		addDescription: `Busca ${realmTerms.plural} que puedas consultar y añade uno a tu lista personal de fuentes de etiquetas.`,
		add: "Añadir fuente",
		remove: "Quitar fuente",
		moveEarlier: "Mover hacia el principio",
		moveLater: "Mover hacia el final",
		empty: "No hay fuentes de etiquetas seleccionadas.",
		manage: "Gestionar fuentes de etiquetas",
	},
	unnamedTag: "Etiqueta sin nombre",
	unnamedRealm: `${realmTerms.label} sin nombre`,
	unnamedStructure: `${tagStructureTerms.label} sin nombre`,
} satisfies typeof import("../zh-Hant/tags").default;
