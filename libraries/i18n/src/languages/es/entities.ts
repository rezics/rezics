import { esTerminology } from "@rezics/i18n/terminology/es";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: entityTerms } = esTerminology.entity;

export default {
	fixedProfile: {
		title: "Datos básicos",
		typeRevisionId: "Identificador de revisión del tipo",
		genderRevisionId: "Identificador de revisión del género",
		areaId: "Entrada de la región",
		beginAreaId: "Entrada de la región de origen",
		endAreaId: "Entrada de la región final",
		begin: "Inicio",
		end: "Fin",
		ended: "Ha finalizado",
		referenceNotice:
			"Introduce los identificadores exactos de las revisiones de definición del tipo y del género, y los de las entradas de región existentes para los lugares. Deja vacíos los valores desconocidos.",
		remove: "Eliminar los datos básicos",
		removed: "Datos básicos eliminados",
		resolve: "Confirmar el tipo específico",
		resolveNotice:
			"El tipo específico solo se puede confirmar mientras siga sin determinar. Guarda primero los demás cambios.",
	},
	contextMeasurements: {
		title: "Medidas según el contexto",
		context: "Contenido relacionado",
		chooseContext: "Elegir contenido relacionado",
		noVisibleMeasurement: "No hay medidas actuales visibles para este contexto.",
		edit: "Editar medidas de este contexto",
		millimetres: "milímetros",
		grams: "gramos",
		scopeNotice:
			"Estos valores solo se aplican al contenido elegido. Al guardar, se sustituye todo su conjunto de medidas.",
		unknownNotice: "Deja en blanco los valores desconocidos. El cero se guarda como cero.",
		invalid:
			"Introduce enteros no negativos dentro del rango admitido o deja en blanco los valores desconocidos.",
		save: "Guardar medidas de este contexto",
	},
	entities: entityTerms.pluralLabel,
	tags: "Tags",
	kind: "Tipo",
	verification: "Verificación",
	owner: "Propietario",
	verified: "Verificado",
	unverified: "Sin verificar",
	measurements: "Medidas",
	height: "Estatura",
	weight: "Peso",
	bust: "Busto",
	waist: "Cintura",
	hips: "Cadera",
	centimetreUnit: verbatimTerms.centimetreUnitSymbol.value,
	kilogramUnit: verbatimTerms.kilogramUnitSymbol.value,
	newEntity: `Nueva ${entityTerms.inline}`,
	newTag: "Nuevo tag",
	externalLinksDescription: `Páginas públicas que respaldan la información sobre esta ${entityTerms.inline}.`,
	externalLinksEmpty: "Aún no hay enlaces externos.",
	relatedContentTitle: "Contenido relacionado",
	relatedContentDescription: `Contenido relacionado con esta ${entityTerms.inline}.`,
	relatedContentEmptyTitle: "No hay contenido relacionado",
	relatedContentEmptyDescription: "Todavía no hay contenido relacionado que mostrar.",
} satisfies typeof import("../zh-Hant/entities").default;
