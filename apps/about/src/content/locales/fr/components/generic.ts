import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	record: "Fiche",
	relations: "Relations",
	history: "Historique",
	conceptPreview: "Aperçu conceptuel",
	description:
		"Une interface produit neutre et remplaçable. Elle ne contient ni illustration décorative ni indicateur d’usage inventé.",
	identity: "Identité",
	stableRecord: "Fiche stable",
	unit: "Unit",
	relatedProducts: "Produits associés",
	references: "références",
	publishedState: "État publié",
	sharedCapabilities: "Capacités partagées",
	attribution: "Attribution",
	entity: "Entité",
	tags: "Étiquettes",
	queryable: "interrogeable",
	api: String(verbatimTerms.api.value),
	permissioned: "soumis à autorisation",
} satisfies typeof import("../../en/components/generic").default;

export default content;
