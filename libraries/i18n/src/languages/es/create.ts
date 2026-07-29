import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { esTerminology } from "@rezics/i18n/terminology/es";

const { forms: postTerms } = esTerminology.post;
const { forms: realmTerms } = esTerminology.realm;
const { forms: zoneTerms } = esTerminology.zone;

export default {
	workspace: {
		title: verbatimTerms.studio.value,
		description: "Consulta el contenido que has creado, mantenido o recibido para gestionar.",
		backToApplication: `Volver a ${verbatimTerms.rezics.value}`,
		navigation: `Navegación de ${verbatimTerms.studio.value}`,
		overview: "Tipos de contenido",
		backToOverview: "Volver a los tipos de contenido",
	},
	sections: {
		book: {
			label: "Libros",
			description: "Consulta y gestiona los libros relacionados con tu trabajo.",
		},
		software: {
			label: "Software",
			description:
				"Consulta y gestiona las entradas de software relacionadas con tu trabajo.",
		},
		media: {
			label: "Contenido multimedia",
			description: "Consulta y gestiona el contenido multimedia relacionado con tu trabajo.",
		},
		entity: {
			label: "Entradas de catálogo",
			description:
				"Consulta y gestiona las entradas de catálogo relacionadas con tu trabajo.",
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
	list: {
		create: "Crear",
		empty: "Ningún contenido coincide con los filtros actuales.",
		untitled: "Contenido sin título",
		contributionCount: insert("Contribuciones: {{count}}", { count: Number }),
		activity: {
			visited: "Visitado",
			updated: "Actualizado",
			created: "Creado",
			relevant: "Relacionado",
		},
	},
	filters: {
		viewLabel: "Relación con el trabajo",
		permissionLabel: "Permiso actual",
		workStateLabel: "Estado del trabajo",
		statusLabel: "Estado del contenido",
		visibilityLabel: "Visibilidad",
		sortLabel: "Orden",
		any: "Cualquiera",
		more: "Más filtros",
		clear: "Borrar filtros",
		cancel: "Cancelar",
		apply: "Aplicar filtros",
		views: {
			all: "Mi trabajo",
			created: "Creado por mí",
			contributed: "Con mi contribución",
			assigned: "Asignado directamente",
			delegated: "Delegado por el equipo",
		},
		permissions: {
			"unit.update": "Puede editar",
			"unit.status.update": "Puede cambiar el estado",
			"unit.access.manage": "Puede gestionar el acceso",
		},
		workStates: { actionable: "Se puede gestionar", blocked: "Bloqueado actualmente" },
		statuses: { draft: "Borrador", published: "Publicado", archived: "Archivado" },
		visibilities: { public: "Público", unlisted: "Sin listar", private: "Privado" },
		sorts: {
			recent: "Visitado recientemente",
			updated: "Actualizado recientemente",
			created: "Creado recientemente",
			relevant: "Relevante recientemente",
		},
	},
	relations: {
		created: "Creador",
		contributed: "Colaborador",
		assigned: "Asignado directamente",
		delegated: "Delegado por el equipo",
		blocked: "Bloqueado actualmente",
	},
	developmentBadge: "En desarrollo",
} satisfies typeof import("../zh-Hant/create").default;
