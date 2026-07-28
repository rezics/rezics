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
	emptyCollectionTitle: "Esta colección está vacía",
	emptyCollectionBody:
		"El contenido añadido aparecerá aquí con las mismas tarjetas que en la fuente.",
	contentLabel: "Contenido de la colección",
	itemCount: insert("{{count}} elementos", { count: Number }),
	directCollectionHint:
		"Una colección se añade como un solo elemento; su contenido no se importa de forma recursiva.",
	save: {
		action: "Guardar",
		title: "Guardar en colecciones",
		directDescription: "Elige Favoritos o cualquier colección personalizada.",
		reviewDescription:
			"En las colecciones personalizadas, la reseña se colocará debajo de la obra que evalúa.",
		favoritesDescription:
			"Guarda rápidamente sin crear una estructura de elementos superiores y subordinados.",
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
		description: `Gestiona el contenido, los ${metadataTerms.inline}, la estructura, la presentación, el acceso y el historial.`,
		navigation: "Navegación de gestión de la colección",
		overview: "Áreas de gestión de la colección",
		backToCollection: "Volver a la colección",
		backToContent: "Volver al contenido",
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
				label: "Contenido y estructura",
				description: "Añade, elimina, ordena, anida y destaca contenido.",
			},
			presentation: {
				label: "Presentación",
				description: "Elige el diseño del contenido y la regla de ordenación.",
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
		role: "Función",
		parent: "Elemento superior",
		topLevel: "Nivel superior",
		item: "Elemento estándar",
		featured: "Elemento destacado",
		remove: "Quitar",
		moveEarlier: "Mover hacia el principio",
		moveLater: "Mover hacia el final",
		saveStructure: "Actualizar estructura",
		empty: "Esta colección aún no tiene contenido que se pueda gestionar.",
	},
	presentation: {
		layout: "Diseño",
		order: "Orden",
		save: "Guardar presentación",
		layouts: {
			flat: "Fuente de una columna",
			nested: "Grupos de elementos superiores y subordinados",
			shelf: "Estante de tarjetas",
		},
		orders: {
			manual: "Orden manual",
			name: "Nombre",
			"added-at": "Fecha de incorporación",
		},
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
