import { frTerminology } from "@rezics/i18n/terminology/fr";

const content = {
	preview: `L’interface « ${frTerminology.post.forms.label} » est-elle une véritable capture d’écran du produit ?`,
	status: "Comment l’état d’implémentation est-il déterminé ?",
} satisfies typeof import("../../../../en/products/post/faq/questions").default;

export default content;
