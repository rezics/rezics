import { frTerminology } from "@rezics/i18n/terminology/fr";

const content = {
	preview: `L’interface « ${frTerminology.zone.forms.label} » est-elle une véritable capture d’écran du produit ?`,
	status: "Comment l’état d’implémentation est-il déterminé ?",
} satisfies typeof import("../../../../en/products/zone/faq/questions").default;

export default content;
