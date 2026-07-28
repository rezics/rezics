import { esTerminology } from "@rezics/i18n/terminology/es";

const content = {
	document: "Documento",
	blocks: "Bloques",
	history: "Historial",
	draftBoundary: "Límite del borrador",
	contentTitle: "Título del contenido",
	paragraphBlock: "Bloque de párrafo",
	description: `El contenido estructurado permanece editable aquí. Los cambios publicados solo pasan al Historial en el límite de ${esTerminology.post.forms.inline}.`,
} satisfies typeof import("../../en/components/editor").default;

export default content;
