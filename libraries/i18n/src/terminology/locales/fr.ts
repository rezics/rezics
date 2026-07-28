import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const frTerminology = defineTerminology("fr", {
	follow: {
		status: "approved",
		forms: {
			actionLabel: "Suivre",
			action: "suivre",
			stateLabel: "Suivi",
			gerund: "suivi",
			followed: "suivi",
			undoActionLabel: "Ne plus suivre",
			undoAction: "ne plus suivre",
			follower: "personne qui suit",
			collectionLabel: "Éléments suivis",
		},
		forbidden: ["S’abonner", "Abonnement", "Subscribe", "Subscription"],
	},
	zone: {
		status: "approved",
		forms: { label: "Espace", pluralLabel: "Espaces", inline: "espace", plural: "espaces" },
		forbidden: ["Zone", "Zones"],
	},
	realm: {
		status: "approved",
		forms: {
			label: "Domaine",
			pluralLabel: "Domaines",
			inline: "domaine",
			plural: "domaines",
		},
		forbidden: ["Realm", "Realms"],
	},
	dock: {
		status: "approved",
		forms: {
			label: "Emplacement",
			pluralLabel: "Emplacements",
			inline: "emplacement",
			plural: "emplacements",
		},
		forbidden: ["Dock", "Docks"],
	},
	unitSlug: {
		status: "approved",
		forms: {
			label: "Identifiant de chemin",
			pluralLabel: "Identifiants de chemin",
			inline: "identifiant de chemin",
			plural: "identifiants de chemin",
		},
		forbidden: ["Slug", "slug"],
	},
	post: {
		status: "approved",
		forms: {
			label: "Publication",
			pluralLabel: "Publications",
			inline: "publication",
			plural: "publications",
		},
		forbidden: ["Post", "Posts"],
	},
	label: {
		status: "approved",
		forms: {
			label: "Libellé taxonomique",
			pluralLabel: "Libellés taxonomiques",
			inline: "libellé taxonomique",
			plural: "libellés taxonomiques",
		},
		forbidden: [],
	},
	tagStructure: {
		status: "approved",
		forms: {
			label: "Chemin d’étiquettes",
			pluralLabel: "Chemins d’étiquettes",
			inline: "chemin d’étiquettes",
			plural: "chemins d’étiquettes",
		},
		forbidden: ["Tag structure", "Structure tag"],
	},
	publicationLicense: {
		status: "approved",
		forms: { label: "Licence de publication", inline: "licence de publication" },
		forbidden: [],
	},
	metadata: {
		status: "approved",
		forms: { label: "Métadonnées", inline: "métadonnées" },
		forbidden: ["Informations de base"],
	},
});
