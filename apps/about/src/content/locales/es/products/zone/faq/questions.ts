import { esTerminology } from "@rezics/i18n/terminology/es";

const content = {
	preview: `¿La interfaz de ${esTerminology.zone.forms.inline} es una captura real del producto?`,
	status: "¿Cómo se determina el estado de implementación?",
} satisfies typeof import("../../../../en/products/zone/faq/questions").default;

export default content;
