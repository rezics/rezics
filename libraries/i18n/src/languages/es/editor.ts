import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { esTerminology } from "@rezics/i18n/terminology/es";

const { forms: realmTerms } = esTerminology.realm;
const { forms: zoneTerms } = esTerminology.zone;
const { forms: entityTerms } = esTerminology.entity;

export default {
	loading: "Cargando el editor…",
	loadFailed: "No se ha podido cargar el editor.",
	paragraph: "Párrafo",
	heading2: "Encabezado 2",
	heading3: "Encabezado 3",
	quote: "Cita",
	bold: "Negrita",
	italic: "Cursiva",
	bulletList: "Lista con viñetas",
	numberedList: "Lista numerada",
	link: "Enlace",
	linkPrompt: `Usa una ${verbatimTerms.url.value} con ${verbatimTerms.http.value}, ${verbatimTerms.https.value}, ${verbatimTerms.mailto.value} o una ${verbatimTerms.url.value} relativa.`,
	linkUrl: verbatimTerms.url.value,
	openInNewTab: "Abrir en una pestaña nueva",
	addLink: "Añadir enlace",
	removeLink: "Quitar enlace",
	invalidLink: `Introduce una ${verbatimTerms.url.value} compatible.`,
	undo: "Deshacer",
	redo: "Rehacer",
	style: "Estilo de texto",
	preview: "Vista previa",
	placeholder: "Escribe algo o introduce / para insertar bloques.",
	slashMenu: "Insertar",
	slashHint: `Usa / para los bloques o ${verbatimTerms.profileSlugPrefix.value}, t/, e/, r/, z/ para mencionar Units.`,
	mentionSearchPrompt: "Escribe para buscar.",
	mentionUsers: "Usuarios",
	mentionTags: "Etiquetas",
	mentionEntities: entityTerms.pluralLabel,
	mentionRealms: realmTerms.pluralLabel,
	mentionZones: zoneTerms.pluralLabel,
	unavailableMention: "Unit no disponible",
	richText: "Texto enriquecido",
	toolbar: "Barra de herramientas de formato",
} satisfies typeof import("../zh-Hant/editor").default;
