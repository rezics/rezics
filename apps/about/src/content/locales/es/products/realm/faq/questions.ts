import { esTerminology } from "@rezics/i18n/terminology/es";

const content = {
	preview: `¿La interfaz de ${esTerminology.realm.forms.inline} es una captura real del producto?`,
	status: "¿Cómo se determina el estado de implementación?",
} satisfies typeof import("../../../../en/products/realm/faq/questions").default;

export default content;
