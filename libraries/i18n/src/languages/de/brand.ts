import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { deTerminology } from "@rezics/i18n/terminology/de";

const { forms: realmTerms } = deTerminology.realm;

export default {
	name: verbatimTerms.rezics.value,
	description: "Wo Objekte, Beziehungen, Diskussionen und Wissen gemeinsam wachsen.",
	socialDescription: `Wo Werke, ${realmTerms.plural} und durchdachte Diskussionen zusammenfinden.`,
	pwaDescription: `Entdecke Werke und ${realmTerms.pluralLabel} und beteilige dich an durchdachten Diskussionen.`,
} satisfies typeof import("../zh-Hant/brand").default;
