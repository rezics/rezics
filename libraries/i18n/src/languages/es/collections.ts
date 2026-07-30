import { insert } from "native-i18n";
import { esTerminology } from "@rezics/i18n/terminology/es";

const { forms: metadataTerms } = esTerminology.metadata;

export default {
	title: "Colecciones",
	favorites: "Favoritos",
	newCollection: "Nueva colección",
	createDescription: "Crea una colección para organizar, presentar y compartir contenido.",
	editCollection: "Gestionar colección",
	deleteCollection: "Eliminar colección",
	deleteCollectionPrompt:
		"La colección y su organización no podrán recuperarse después de eliminarla.",
	emptyCollections: "Todavía no tienes ninguna colección.",
	containingUnitEmpty: "Todavía no hay ninguna colección pública que incluya esta obra.",
	emptyCollectionTitle: "Esta colección está vacía",
	emptyCollectionBody:
		"El contenido añadido aparecerá aquí con las mismas tarjetas que en la fuente.",
	contentLabel: "Contenido de la colección",
	itemCount: insert("{{count}} elementos", { count: Number }),
	directCollectionHint:
		"Una colección se añade como un solo elemento; su contenido no se importa de forma recursiva.",
	publishers: {
		label: "Editorial",
		unknown: "Sin editorial acreditada",
		current: "Editoriales actuales",
		currentDescription:
			"Estos perfiles reciben el crédito de editorial en la colección y en las fuentes.",
	},
	save: {
		action: "Guardar",
		title: "Guardar en colecciones",
		directDescription:
			"Elige Favoritos o una colección personalizada. Al guardar una reseña en una colección personalizada, su objeto se añade primero si es necesario.",
		searchLabel: "Buscar una colección",
		searchPlaceholder: "Introduce el nombre de una colección",
		noMatches: "No hay colecciones coincidentes.",
		noCollections: "Todavía no tienes ninguna colección que pueda recibir contenido.",
		createLabel: "Crear colección",
		createPlaceholder: "Nombre de la colección",
		createAndSave: "Crear y guardar",
		manage: "Gestionar colecciones",
		saved: "Guardado",
		notSaved: "Sin guardar",
	},
	workspace: {
		title: "Gestión de la colección",
		description: `Gestiona el contenido, los ${metadataTerms.inline}, el orden, las editoriales, el acceso y el historial.`,
		navigation: "Navegación de gestión de la colección",
		overview: "Áreas de gestión de la colección",
		backToCollection: "Volver a la colección",
		backToOverview: "Volver a los ajustes",
		sections: {
			content: {
				label: "Contenido",
				description:
					"Edita el título, el resumen y la portada en cada idioma del contenido.",
			},
			metadata: {
				label: metadataTerms.label,
				description: `Define los ${metadataTerms.inline} de estado y visibilidad o elimina la colección.`,
			},
			items: {
				label: "Contenido y orden",
				description: "Añade, elimina, selecciona y ordena varios elementos.",
			},
			publishers: {
				label: "Editoriales",
				description: "Gestiona los perfiles de editorial que se muestran públicamente.",
			},
			access: {
				label: "Acceso",
				description: "Gestiona los sujetos de autorización, permisos y restricciones.",
			},
			history: {
				label: "Historial",
				description: "Revisa, compara y restaura versiones de la colección.",
			},
		},
	},
	items: {
		add: "Añadir contenido",
		target: "Contenido",
		selectAll: "Seleccionar todos los elementos cargados",
		clearSelection: "Borrar selección",
		selectedCount: insert("{{count}} elementos seleccionados", { count: Number }),
		selectItem: insert("Seleccionar {{title}}", { title: String }),
		removeItem: insert("Quitar {{title}}", { title: String }),
		move: "Mover",
		moveTitle: "Mover los elementos seleccionados",
		moveDescription:
			"Se conserva el orden relativo de los elementos y el cambio se aplica de forma atómica.",
		destination: "Destino",
		moveToStart: "Mover al principio",
		moveToEnd: "Mover al final",
		moveAfter: "Mover después de un elemento",
		afterItem: "Elemento anterior",
		chooseDestination: "Elegir un elemento",
		applyMove: "Aplicar movimiento",
		empty: "Esta colección aún no tiene contenido que se pueda gestionar.",
	},
	form: {
		language: "Idioma del contenido",
		title: "Título",
		summary: "Resumen",
		cover: "Portada",
		status: "Estado",
		visibility: "Visibilidad",
		save: "Guardar cambios",
	},
	cancel: "Cancelar",
	delete: "Eliminar",
	close: "Cerrar",
} satisfies typeof import("../zh-Hant/collections").default;
