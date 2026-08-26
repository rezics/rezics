import { insert } from "native-i18n";

import { esTerminology } from "@rezics/i18n/terminology/es";

const { forms: followTerms } = esTerminology.follow;
const { forms: postTerms } = esTerminology.post;
const { forms: realmTerms } = esTerminology.realm;
const { forms: entityTerms } = esTerminology.entity;
const { forms: tagPathTerms } = esTerminology.tagPath;
const { forms: zoneTerms } = esTerminology.zone;
const { forms: videoTerms } = esTerminology.video;
const { forms: audioTerms } = esTerminology.audio;

export default {
	title: "Novedades",
	subtitle: "Las obras cobran visibilidad a través de la conversación",
	personalized: "Para ti",
	sortLabel: "Orden de novedades",
	sort: { best: "Mejor", new: "Nuevo" },
	filtersLabel: "Filtros de novedades",
	filters: {
		title: "Filtros",
		clear: "Borrar filtros",
		cancel: "Cancelar",
		apply: "Aplicar filtros",
		selectedCount: insert("{{count}} seleccionados", { count: Number }),
		languages: {
			label: "Idiomas",
			all: "Todos los idiomas",
			options: { zh: "Chino", en: "Inglés" },
		},
		realms: {
			label: realmTerms.label,
			all: `Todos los ${realmTerms.plural}`,
			unnamed: `${realmTerms.label} sin nombre`,
		},
		tags: {
			label: "Etiquetas",
			all: "Todas las etiquetas",
			unnamed: "Etiqueta sin nombre",
		},
	},
	contentFilterLabel: "Filtro de contenido",
	pagination: {
		label: "Carga de más contenido",
		modes: {
			"load-more": "Mostrar el botón «Cargar más»",
			infinite: "Cargar automáticamente al desplazarse",
		},
	},
	content: {
		clear: "Borrar todo",
		allSelected: "Todo el contenido",
		selectedCount: insert("{{count}} seleccionados", { count: Number }),
		unitGroup: "Units",
		postGroup: postTerms.pluralLabel,
		kinds: {
			"unit:profile": "Perfiles",
			"unit:book": "Libros",
			"unit:software": "Software",
			"unit:media": "Contenido multimedia",
			"unit:video": videoTerms.pluralLabel,
			"unit:audio": audioTerms.label,
			"unit:release": "Versiones",
			"unit:entity": entityTerms.pluralLabel,
			"unit:tag": "Etiquetas",
			"unit:structure": tagPathTerms.pluralLabel,
			"unit:series": "Series",
			"unit:zone": zoneTerms.pluralLabel,
			"unit:collection": "Colecciones",
			"unit:poll": "Encuestas",
			"unit:realm": realmTerms.pluralLabel,
			"post:post": postTerms.pluralLabel,
			"post:reply": "Respuestas",
			"post:excerpt": "Fragmentos",
			"post:review": "Reseñas",
			"post:chapter": "Capítulos",
			"post:wiki": "Artículos de wiki",
			"post:picture": `${postTerms.pluralLabel} con imagen`,
		},
		postDescription: "Conversaciones iniciadas por miembros de la comunidad",
		replyDescription: "Respuestas dentro de conversaciones en curso",
	},
	discoverWorks: "Descubre obras que merecen tu tiempo",
	emptyTitle: "Todo está tranquilo por aquí",
	emptyBody: "Sé la primera persona en compartir una obra o una idea.",
	reason: {
		followedUnit: `Porque has decidido ${followTerms.action} este elemento o a una persona acreditada en él`,
		followedRealm: `Porque has decidido ${followTerms.action} el ${realmTerms.inline}`,
		basedOnActivity: "Basado en tu actividad reciente",
		relatedSubject: "Relacionado con lo que estás viendo",
		popularNow: "Popular ahora",
		newAndRelevant: "Nuevo y posiblemente relevante",
	},
	recommendationMenu: "Opciones de recomendación",
	moreActions: "Más acciones",
	notInterested: "No me interesa",
	actions: {
		voteGroup: "Valoración del contenido",
		comments: insert("{{count}} respuestas", { count: Number }),
		shareTitle: "Compartir contenido",
		shareDescription: "Usa el menú de compartir de tu dispositivo o copia el enlace del contenido.",
		shareNative: "Compartir con otra aplicación",
		copyLink: "Copiar enlace",
		linkCopied: "Enlace copiado",
		shareFailed: "No se ha podido compartir. Inténtalo de nuevo más tarde.",
		saved: "Guardado",
		addToCollection: "Añadir a una colección",
		collectionPickerTitle: "Añadir a una colección",
		collectionPickerDescription: "Elige una colección para este contenido.",
		collectionAdded: "Añadido a la colección",
		noOwnedCollections: "Todavía no tienes ninguna colección disponible.",
		manageCollections: "Gestionar colecciones",
	},
	replyingIn: "Respuesta en",
	relatedPosts: "Conversaciones relacionadas",
	relatedWorks: "Obras similares",
	activeRealms: `${realmTerms.pluralLabel} activos`,
	continueReading: "Continuar leyendo",
	viewAll: "Ver todo",
	relatedWork: "Obra relacionada",
	realmTagContext: `Explicación de etiqueta del ${realmTerms.label}`,
	excerptSource: "Fuente del fragmento",
	excerptSourceMark: "―",
	myRealms: `Mis ${realmTerms.pluralLabel}`,
	contextSeparator: "en",
	attributionList: insert("{{count}} colaboradores acreditados", { count: Number }),
	realmList: insert(`{{count}} ${realmTerms.plural}`, { count: Number }),
	showAttributionList: insert("{{attribution}} y {{count}} más; mostrar créditos", {
		attribution: String,
		count: Number,
	}),
	showRealmList: insert(`{{realm}} y {{count}} más; mostrar la lista de ${realmTerms.plural}`, {
		realm: String,
		count: Number,
	}),
	targetScore: insert("{{score}}/10 · {{count}} valoraciones", {
		score: String,
		count: Number,
	}),
	noRatings: "Todavía no hay valoraciones",
	collectionDirectItems: insert("{{count}} elementos directos", { count: Number }),
} satisfies typeof import("../zh-Hant/feed").default;
