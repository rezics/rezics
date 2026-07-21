import { deTerminology } from "@rezics/i18n/terminology/de";

const content = {
	preview: `Ist die Ansicht von ${deTerminology.zone.forms.inline} ein echter Screenshot?`,
	status: "Wie wird der Implementierungsstatus bestimmt?",
} satisfies typeof import("../../../../en/products/zone/faq/questions").default;

export default content;
