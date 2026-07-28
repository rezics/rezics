import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	preview: `L’interface ${verbatimTerms.api.value} et ${verbatimTerms.oauth.value} est-elle une véritable capture d’écran du produit ?`,
	status: "Comment l’état d’implémentation est-il déterminé ?",
} satisfies typeof import("../../../../en/products/api-oauth/faq/questions").default;

export default content;
