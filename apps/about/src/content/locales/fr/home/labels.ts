import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	eyebrow: `Système de produits ${verbatimTerms.rezics.value}`,
	title: "Les contenus peuvent conserver leur identité, leur structure et leur historique.",
	stageTitle: `Découvrez ${verbatimTerms.rezics.value} à travers ses interfaces produit`,
	productsTitle: "Chaque produit possède son propre point d’entrée",
	platformTitle: "Les capacités partagées fonctionnent entre les produits",
	formulaTitle: "Comment les capacités composent les produits",
	historyTitle: `L’historique constitue la colonne vertébrale informationnelle de ${verbatimTerms.rezics.value}`,
	openTitle: "Une ouverture qui va de la documentation au code source",
	eyebrows: {
		stage: "Mise en scène du produit",
		products: "Produits",
		platform: "Plateforme",
		composition: "Composition",
		history: "Historique",
		openSource: "Code source ouvert",
	},
	formulaResults: {
		chapters: "Structure des chapitres",
		credits: "Relations entre auteurs, traducteurs et éditeurs",
		subjects: "Relations entre personnages, sujets et œuvres dérivées",
	},
} satisfies typeof import("../../en/home/labels").default;

export default content;
