import { deTerminology } from "@rezics/i18n/terminology/de";

const content = {
	preview: `Ist die Ansicht von ${deTerminology.realm.forms.inline} ein echter Screenshot?`,
	status: "Wie wird der Implementierungsstatus bestimmt?",
} satisfies typeof import("../../../../en/products/realm/faq/questions").default;

export default content;
