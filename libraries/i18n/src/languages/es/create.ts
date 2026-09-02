import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { esTerminology } from "@rezics/i18n/terminology/es";

const { forms: postTerms } = esTerminology.post;
const { forms: realmTerms } = esTerminology.realm;
const { forms: entityTerms } = esTerminology.entity;
const { forms: zoneTerms } = esTerminology.zone;

export default {
	workspace: {
		title: verbatimTerms.studio.value,
		description:
			"Consulta el contenido que puedes editar ahora o el contenido público al que contribuiste.",
		backToApplication: `Volver a ${verbatimTerms.rezics.value}`,
		navigation: `Navegación de ${verbatimTerms.studio.value}`,
		overview: "Tipos de contenido",
		backToOverview: "Volver a los tipos de contenido",
	},
	mode: {
		label: "Lista de contenido",
		options: {
			workspace: "Tu espacio de trabajo",
			contributions: "Tus contribuciones",
		},
	},
	lifecycle: {
		configurable: "Propiedad y visibilidad configurables",
		publish_now: "Se publica al crear",
		private_first: "Privado al crear",
		immutable: "Definición inmutable",
		preview: "Función en vista previa",
	},
	entityHelp: {
		label: "Más información sobre los créditos",
		title: "Información sobre los créditos",
		description: `Los créditos deben vincularse a una ${entityTerms.inline}. Si no encuentras una ${entityTerms.inline} o quieres crear, por ejemplo, una identidad de autor para ti, crea primero una ${entityTerms.inline}.`,
		createEntity: `Crear una ${entityTerms.inline}`,
		close: "Cerrar",
	},
	sections: {
		book: {
			label: "Libros",
			description: "Consulta y gestiona los libros relacionados con tu trabajo.",
		},
		software: {
			label: "Software",
			description: "Consulta y gestiona las entradas de software relacionadas con tu trabajo.",
		},
		media: {
			label: "Contenido multimedia",
			description: "Consulta y gestiona el contenido multimedia relacionado con tu trabajo.",
		},
		entity: {
			label: entityTerms.pluralLabel,
			description: `Consulta y gestiona las ${entityTerms.plural} relacionadas con tu trabajo.`,
		},
		tag: {
			label: "Etiquetas",
			description: "Consulta y gestiona las etiquetas relacionadas con tu trabajo.",
		},
		realm: {
			label: realmTerms.label,
			description: `Consulta y gestiona los ${realmTerms.plural} relacionados con tu trabajo.`,
		},
		zone: {
			label: zoneTerms.label,
			description: `Consulta y gestiona las ${zoneTerms.plural} relacionadas con tu trabajo.`,
		},
		post: {
			label: postTerms.label,
			description: `Consulta y gestiona las ${postTerms.plural} relacionadas con tu trabajo.`,
		},
		wiki: {
			label: "Artículos de wiki",
			description: "Consulta y gestiona los artículos de wiki que mantienes.",
		},
		collection: {
			label: "Colecciones",
			description: "Consulta y gestiona las colecciones relacionadas con tu trabajo.",
		},
		review: {
			label: "Reseñas",
			description: "Consulta y gestiona las reseñas relacionadas con tu trabajo.",
		},
		poll: {
			label: "Encuestas",
			description: "Consulta y gestiona las encuestas relacionadas con tu trabajo.",
		},
	},
	realmTagContext: {
		label: `Explicación de etiqueta del ${realmTerms.label}`,
		description: `Crea la explicación wiki de este ${realmTerms.inline} para una etiqueta.`,
	},
	communityUnitSearch: {
		policyTitle: "Busca antes de crear",
		policy:
			"Para mantener una comunidad saludable, busca antes de crear una entrada pública y confirma que el contenido que quieres crear todavía no existe. El uso indebido de esta función puede conllevar sanciones.",
		confirmationLabel: insert(
			"He buscado entre {{subject}} existentes y he confirmado que esta entrada aún no existe.",
			{ subject: String },
		),
		prompt: insert("Buscar {{subject}} existentes", { subject: String }),
		pageTitle: insert("Buscar {{subject}} existentes", { subject: String }),
		pageDescription: insert("Comprueba si los {{subject}} que quieres crear ya existen.", {
			subject: String,
		}),
		backToSection: insert("Volver a {{subject}}", { subject: String }),
		searchLabel: insert("Buscar {{subject}}", { subject: String }),
		searchPlaceholder: insert("Introduce el nombre de los {{subject}}", { subject: String }),
		searchAction: "Buscar",
		searchHint: "Introduce un nombre para buscar entradas que quizá ya existan.",
		searchFailed:
			"La búsqueda no está disponible temporalmente. Vuelve a intentarlo o regresa al formulario de creación.",
		resultsTitle: "Posibles entradas existentes",
		noResultsTitle: insert("No se encontraron {{subject}} coincidentes", { subject: String }),
		noResultsDescription:
			"Después de comprobar que los términos son correctos, puedes continuar con la creación.",
		realmTagContextOnly: `Aquí solo aparecen las etiquetas explicadas formalmente por este ${realmTerms.inline}. Si falta alguna, la administración del ${realmTerms.inline} debe crear primero su explicación.`,
		notListedTitle: "¿Ninguno de estos resultados coincide?",
		notListedDescription:
			"Revisa primero las entradas similares. Continúa solo si ninguna es el contenido que necesitas.",
		createAction: "Continuar con la creación",
		subjects: {
			book: "libros",
			software: "entradas de software",
			media: "entradas multimedia",
			person: "personas",
			organization: "organizaciones",
			character: "personajes",
			tag: "etiquetas",
		},
	},
	list: {
		create: "Crear",
		empty: {
			workspace: "Ningún contenido editable coincide con los filtros actuales.",
			contributions: "Ninguna contribución pública coincide con los filtros actuales.",
		},
		untitled: "Contenido sin título",
		immutable: "Inmutable",
		contributionCount: insert("Contribuciones: {{count}}", { count: Number }),
		activity: {
			visited: "Visitado",
			assigned: "Asignado",
			created: "Creado",
			participated: "Contribución",
		},
	},
	filters: {
		sourceLabel: "Origen del espacio de trabajo",
		kindLabel: "Tipo de contribución",
		statusLabel: "Estado del contenido",
		visibilityLabel: "Visibilidad",
		any: "Cualquiera",
		more: "Más filtros",
		clear: "Borrar filtros",
		cancel: "Cancelar",
		apply: "Aplicar filtros",
		sources: {
			all: "Todo el contenido editable",
			owned: "De mi propiedad",
			direct: "Asignado directamente",
			delegated: "Delegado por el equipo",
		},
		kinds: {
			all: "Todas las contribuciones",
			created: "Creado por mí",
			contributed: "Editado por mí",
		},
		statuses: { draft: "Borrador", published: "Publicado", archived: "Archivado" },
		visibilities: { public: "Público", unlisted: "Sin listar", private: "Privado" },
	},
	relations: {
		owner: "Propietario",
		direct: "Asignado directamente",
		realm: "Delegado por el equipo",
		created: "Creador",
		contributed: "Colaborador",
	},
	developmentBadge: "En desarrollo",
} satisfies typeof import("../zh-Hant/create").default;
