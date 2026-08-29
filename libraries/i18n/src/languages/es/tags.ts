import { insert } from "native-i18n";

import { esTerminology } from "@rezics/i18n/terminology/es";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: realmTerms } = esTerminology.realm;
const { forms: followTerms } = esTerminology.follow;
const { forms: postTerms } = esTerminology.post;
const { forms: tagPathTerms } = esTerminology.tagPath;

export default {
	page: {
		title: "Etiquetas",
		description:
			"Revisa las etiquetas globales y las valoraciones contextuales de las fuentes de etiquetas que hayas seleccionado.",
		viewAll: "Ver la página completa de la etiqueta",
		more: insert("{{count}} más", { count: Number }),
		manageOnTagPage: `Añade etiquetas y ${tagPathTerms.plural} en la página específica de etiquetas para que su contexto de votación siga visible.`,
	},
	card: {
		open: insert("Abrir la tarjeta de la etiqueta {{tag}} ({{context}})", {
			tag: String,
			context: String,
		}),
		close: "Cerrar la tarjeta de la etiqueta",
		globalContext: "Contexto global",
		pathContext: tagPathTerms.label,
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
		description: `Etiquetas globales y ${tagPathTerms.plural}, sin valoraciones contextuales de ningún ${realmTerms.inline}.`,
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
	paths: {
		title: tagPathTerms.pluralLabel,
		description: `Las ${tagPathTerms.plural} conservan la estructura del vocabulario; el significado aplicado procede de un sentido de ruta explícito.`,
		addTitle: `Añadir una ${tagPathTerms.inline}`,
		addDescription: `Busca significados explícitos de etiqueta y de ruta. Aplicar un sentido de ruta no aplica todas las etiquetas de la ruta.`,
		add: `Añadir ${tagPathTerms.inline}`,
		create: `Crear ${tagPathTerms.inline}`,
		details: `Ver ${tagPathTerms.inline}`,
		empty: `Esta obra todavía no tiene ninguna ${tagPathTerms.inline} aceptada.`,
		memberFallback: "Etiqueta sin nombre",
		pathLabel: `${tagPathTerms.label} ordenada`,
		fitLabel: "Adecuación",
		spoilerLabel: "Nivel de destripes",
		spoilerNone: "Ninguno",
		spoilerMinor: "Leve",
		spoilerMajor: "Importante",
		spoilerSummary: insert("Votos: {{none}} ninguno · {{minor}} leve · {{major}} importante", {
			none: Number,
			minor: Number,
			major: Number,
		}),
	},
	expressions: {
		title: "Significados de etiqueta aplicados",
		description:
			"El mismo significado dentro de una autoridad se agrupa, pero cada fuente directa o procedente de una ruta se puede consultar por separado.",
		empty: "Todavía no se ha aplicado ningún significado de etiqueta.",
		open: insert("Abrir la ficha del significado {{expression}} ({{authority}})", {
			expression: String,
			authority: String,
		}),
		close: "Cerrar la ficha del significado de etiqueta",
		applicationsTitle: "Aplicaciones en este contenido",
		applicationCount: insert("{{count}} fuentes de aplicación", { count: Number }),
		directApplication: "Aplicación directa",
		pathApplication: "Aplicación de un sentido de ruta",
		sourceDate: insert("Creada el {{date}}", { date: String }),
		sourceContributor: "Ver a la persona colaboradora",
		removeApplication: "Eliminar esta aplicación de ruta",
		showCompletePath: "Mostrar la ruta completa",
		otherPositionsTitle: "Otras posiciones de esta etiqueta",
		otherPositionsDescription:
			"Estas posiciones pertenecen a la estructura del vocabulario, pero no están aplicadas a este contenido.",
		authoritySection: insert("Significados de etiqueta de {{authority}}", { authority: String }),
		relationFallback: "Relación",
		relations: {
			generic: "Tipo",
			partitive: "Parte",
			instance: "Instancia",
			organizational: "Organización",
			facet_value: "Valor de faceta",
		},
	},
	searchMatches: {
		matched: "Coincidencia:",
		why: "Por qué coincide este resultado",
		evidence: {
			direct: "Aplicación directa de la etiqueta",
			primary: "Significado de etiqueta aplicado",
			entailed: "Inferencia semántica",
			retrieval_only: "Expansión de búsqueda",
		},
		otherPositions: insert("{{count}} posiciones más en el vocabulario", { count: Number }),
	},
	semantics: {
		structureTitle: "Estructura del vocabulario",
		structureDescription:
			"Esta ruta solo registra una posición del vocabulario y relaciones tipadas. No atribuye automáticamente cada miembro al contenido.",
		sensesTitle: "Significados de la ruta",
		sensesDescription:
			"Cada significado vincula miembros de la ruta con una expresión de etiqueta completa que puede aplicarse al contenido.",
		noSenses: "Esta ruta aún no tiene un significado aplicable.",
		expressionKind: "Tipo de expresión",
		expressionKinds: {
			simple: "Concepto único",
			facet_value: "Faceta y valor",
			relation: "Relación y objeto",
		},
		focus: "Concepto principal",
		value: "Valor",
		slot: "Faceta",
		predicate: "Relación",
		scope: "Alcance",
		globalScope: "Global",
		realmScope: realmTerms.label,
		status: "Estado",
		statuses: { active: "Activo", retired: "Retirado" },
		labelSignature: "Componentes de la etiqueta independiente",
		bindingsTitle: "Vínculos entre miembros y funciones",
		roles: {
			predicate: "Relación",
			slot: "Faceta",
			value: "Valor",
			focus: "Principal",
			qualifier: "Calificador",
		},
		inferenceRulesTitle: "Reglas de inferencia explícitas",
		noInferenceRules: "Esta expresión no tiene reglas de inferencia adicionales.",
		inferenceKind: "Tipo de regla",
		inferenceKinds: { entailed: "Implicación semántica", retrieval_only: "Solo búsqueda" },
		inferenceTarget: "Destino de la regla",
		targetTag: "Etiqueta de destino",
		targetExpression: "Expresión de destino",
		ruleRevision: insert("Revisión {{revision}}", { revision: Number }),
		provenance: "Registro de procedencia",
		curationTitle: "Curación semántica",
		curationDescription:
			"Crea vínculos semánticos inmutables y añade inferencias solo mediante reglas explícitas y gobernadas.",
		createSense: "Crear un significado de ruta",
		createSenseAction: "Crear significado",
		sense: "Significado de origen",
		addInference: "Añadir una regla de inferencia",
		expressionId: `${verbatimTerms.id.value} de expresión`,
		expressionIdPlaceholder: `Introduce el ${verbatimTerms.id.value} inmutable de la expresión de destino`,
		addInferenceAction: "Añadir regla",
		lifecycleTitle: "Retirar definiciones",
		lifecycleDescription:
			"La retirada conserva el historial de las aplicaciones existentes. Un significado retirado no puede volver a aplicarse; una regla retirada deja de contribuir a los resultados de inferencia reconstruidos.",
		retireSenseAction: "Retirar significado",
		retireSenseConfirm:
			"¿Retirar este significado? Las aplicaciones existentes conservan su historial, pero las nuevas no podrán usarlo.",
		retireInferenceAction: "Retirar regla",
		retireInferenceConfirm:
			"¿Retirar esta regla? Dejará de contribuir a los resultados de inferencia y búsqueda reconstruidos.",
		directMeaningTitle: "Significado directo de la etiqueta",
		directMeaningDescription:
			"Las aplicaciones directas de esta etiqueta usan esta expresión de concepto único.",
		qualifiedTitle: "Expresiones calificadas",
		qualifiedDescription:
			"Estas expresiones usan el concepto como valor de faceta, relación o calificador.",
		noQualified: "Aún no hay expresiones calificadas que usen este concepto.",
		positionsTitle: "Todas las posiciones del vocabulario",
		positionsDescription:
			"Estas son las posiciones del concepto en la estructura global del vocabulario; no indican que algún contenido las haya adoptado.",
		noPositions: "Este concepto aún no aparece en una ruta aceptada.",
		inferredReachTitle: "Alcance inferido",
		inferredReachDescription:
			"Estas expresiones alcanzan el concepto mediante una regla explícita de implicación o expansión de búsqueda.",
		noInferredReach: "Actualmente ninguna expresión infiere ni se expande hasta este concepto.",
		directUsagesTitle: "Aplicaciones directas",
		directUsagesDescription:
			"Aquí solo aparece contenido con una aplicación directa de este concepto único.",
		semanticReachTitle: "Alcance semántico y de búsqueda",
		semanticReachDescription:
			"Aquí aparece contenido relacionado mediante una expresión principal, una implicación semántica o una expansión de búsqueda.",
	},
	detail: {
		sections: "Pestañas de detalles de la etiqueta",
		tabs: {
			overview: "Resumen",
			discussion: "Debate",
			content: "Contenido relacionado",
			paths: "Jerarquía",
		},
		overviewTitle: "Descripción de la etiqueta",
		overviewDescription:
			"Lee la explicación completa de esta etiqueta. El resumen permanece visible en tarjetas y vistas previas.",
		bodyEmpty: "Esta etiqueta todavía no tiene una descripción detallada.",
		discussionTitle: "Debate",
		discussionDescription: `Crea ${postTerms.plural} sobre esta etiqueta y participa en los debates existentes.`,
		contentTitle: "Contenido relacionado",
		contentDescription: "Explora obras y otros contenidos que usan esta etiqueta.",
		pathsTitle: "Jerarquía de la etiqueta",
		pathsDescription:
			"Consulta dónde aparece esta etiqueta en estructuras aprobadas por la comunidad.",
		editTitle: "Editar el contenido de la etiqueta",
		editDescription:
			"Actualiza el título, el resumen y la descripción en el idioma de contenido actual.",
		editNavigation: "Gestión del contenido de la etiqueta",
		backToTag: "Volver a la etiqueta",
		backToEditOverview: "Volver al resumen de edición",
		childrenTitle: "Etiquetas subordinadas directas",
		childrenDescription: `Estas relaciones proceden de ${tagPathTerms.plural} aceptadas y bloqueadas por la comunidad. Cada elemento subordinado muestra sus propios elementos subordinados directos.`,
		noChildren: "Esta etiqueta todavía no tiene elementos subordinados directos aceptados.",
		grandchildrenTitle: "Elementos subordinados directos",
	},
	createPath: {
		title: `Crear ${tagPathTerms.inline}`,
		description:
			"Crea una ruta ordenada desde las etiquetas más generales hasta las más específicas. Las definiciones no se pueden editar después de crearlas; crea otra ruta y presenta una propuesta de gobernanza manual.",
		pick: "Elegir la siguiente etiqueta",
		addMember: "Añadir a la ruta",
		removeMember: "Quitar de la ruta",
		moveEarlier: "Mover hacia el principio",
		moveLater: "Mover hacia el final",
		preview: "Vista previa de la ruta bloqueada por la comunidad",
		relationKind: "Relación con el nodo anterior",
		minimum: "Añade al menos dos etiquetas distintas.",
		submit: `Crear ${tagPathTerms.inline} y votar`,
		relatedTitle: "Revisar rutas aceptadas relacionadas",
		relatedDescription:
			"Estas rutas ya terminan en la misma etiqueta. No son duplicados automáticos; revisa su significado antes de crear una definición inmutable distinta.",
		continueDistinct: "Crear una ruta distinta",
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
		pathsTitle: `${tagPathTerms.pluralLabel} del ${realmTerms.label}`,
		applyPath: "Aplicar ruta",
		authority: { realm: `Este ${realmTerms.label}`, global: "Global" },
		pathAuthority: insert("Adecuación: {{fit}} · destripes: {{spoiler}}", {
			fit: String,
			spoiler: String,
		}),
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
	unnamedPath: `${tagPathTerms.label} sin nombre`,
} satisfies typeof import("../zh-Hant/tags").default;
