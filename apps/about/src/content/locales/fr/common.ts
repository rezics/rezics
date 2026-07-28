import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	siteName: verbatimTerms.rezics.value,
	nav: {
		products: "Produits",
		platform: "Plateforme",
		history: "Historique",
		docs: "Documentation",
		github: verbatimTerms.github.value,
		language: "Langue",
		theme: "Thème",
		openMenu: "Ouvrir le menu",
		closeMenu: "Fermer le menu",
	},
	theme: {
		light: "Clair",
		dark: "Sombre",
		toggle: "Changer de thème de couleurs",
	},
	status: {
		implemented: "Implémenté",
		documented: "Conception documentée",
		planned: "Planifié",
		research: "Recherche",
	},
	classes: {
		surface: "Interface produit",
		capability: "Capacité partagée",
		manifestation: "Déclinaison de produit",
		protocol: "Protocole interne",
	},
	labels: {
		conceptPreview: "Aperçu conceptuel",
		conceptCaption:
			"Une mise en scène de produit remplaçable, native du code, qui pourra ensuite céder la place à une véritable capture d’écran de mêmes dimensions.",
		viewProduct: "Voir le produit",
		viewAll: "Tout voir",
		learnMore: "En savoir plus",
		documentation: `Documentation ${verbatimTerms.outline.value}`,
		sourceCode: "Code source",
		relatedProducts: "Produits associés",
		usedCapabilities: "Capacités partagées utilisées",
		noParent: "Produit indépendant, sans produit porteur parent",
		parentProduct: "Produit parent",
		sourceBasis: "Sources factuelles",
	},
	footer: {
		statement: `${verbatimTerms.rezics.value} est un système de produits ouvert fondé sur l’identité, la structure et l’historique des contenus.`,
		productLinks: "Produits",
		platformLinks: "Plateforme",
		openLinks: "Ouverture",
		implementation: `${verbatimTerms.agpl30.value} · Site statique construit avec ${verbatimTerms.vike.value} et ${verbatimTerms.react.value}`,
	},
	notFound: {
		title: "Page introuvable",
		body: "Ce lien a peut-être été déplacé ou ne correspond pas à une page produit publique.",
		back: "Retour à l’accueil",
	},
	a11y: {
		home: `Accueil ${verbatimTerms.rezics.value}`,
		skipContent: "Aller au contenu principal",
		primaryNavigation: "Navigation principale",
		mobileNavigation: "Navigation mobile",
		breadcrumb: "Fil d’Ariane",
		modes: "Modes",
	},
} satisfies typeof import("../en/common").default;

export default content;
