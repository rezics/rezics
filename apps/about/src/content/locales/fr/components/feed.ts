import { frTerminology } from "@rezics/i18n/terminology/fr";

const content = {
	consumers: "Produits utilisant cette capacité",
	zone: frTerminology.zone.forms.label,
	realm: frTerminology.realm.forms.label,
	home: "Accueil",
	zoneFeed: `Fil d’un ${frTerminology.zone.forms.inline}`,
	realmFeed: `Fil d’un ${frTerminology.realm.forms.inline}`,
	homeFeed: "Fil d’accueil",
	postCard: `Carte de ${frTerminology.post.forms.inline}`,
	bookCard: "Carte de livre",
	commentCard: "Carte de commentaire",
	kindAware: "adapté au type",
	catalog: "catalogue",
	discussion: "discussion",
	consumerConfiguration: "Configuration du produit consommateur",
	query: "Requête",
	consumerScope: "périmètre du produit consommateur",
	card: "Carte",
	perFeature: "par fonctionnalité",
	order: "Ordre",
	feedOrder: "ordre du fil",
} satisfies typeof import("../../en/components/feed").default;

export default content;
