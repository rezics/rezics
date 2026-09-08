import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const frTerminology = defineTerminology("fr", {
	music: {
		status: "approved",
		forms: { label: "Musique", inline: "musique", plural: "musique" },
		forbidden: [],
	},
	musicRecording: {
		status: "approved",
		forms: {
			label: "Enregistrement musical",
			inline: "enregistrement musical",
			plural: "enregistrement musical",
		},
		forbidden: [],
	},
	musicTrack: {
		status: "approved",
		forms: { label: "Piste musicale", inline: "piste musicale", plural: "pistes musicales" },
		forbidden: [],
	},
	musicMedium: {
		status: "approved",
		forms: { label: "Support musical", inline: "support musical", plural: "supports musicaux" },
		forbidden: [],
	},
	musicRelease: {
		status: "approved",
		forms: { label: "Parution musicale", inline: "parution musicale", plural: "parution musicale" },
		forbidden: [],
	},
	musicReleaseGroup: {
		status: "approved",
		forms: {
			label: "Groupe de parutions",
			inline: "groupe de parutions",
			plural: "groupe de parutions",
		},
		forbidden: [],
	},
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
	video: {
		status: "approved",
		forms: { label: "Vidéo", pluralLabel: "Vidéos", inline: "vidéo", plural: "vidéos" },
		forbidden: [],
	},
	customTheme: {
		status: "approved",
		forms: {
			label: "Thème personnalisé",
			pluralLabel: "Thèmes personnalisés",
			inline: "thème personnalisé",
			plural: "thèmes personnalisés",
		},
		forbidden: [],
	},
	audio: {
		status: "approved",
		forms: { label: "Audio", pluralLabel: "Audios", inline: "audio", plural: "audios" },
		forbidden: [],
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
	tagPath: {
		status: "approved",
		forms: {
			label: "Chemin d’étiquettes",
			pluralLabel: "Chemins d’étiquettes",
			inline: "chemin d’étiquettes",
			plural: "chemins d’étiquettes",
		},
		forbidden: ["Tag structure", "Structure tag"],
	},
	license: {
		status: "approved",
		forms: { label: "Licence", inline: "licence" },
		forbidden: [],
	},
	entity: {
		status: "approved",
		forms: { label: "Entité", pluralLabel: "Entités", inline: "entité", plural: "entités" },
		forbidden: ["Catalog"],
	},
	metadata: {
		status: "approved",
		forms: { label: "Métadonnées", inline: "métadonnées" },
		forbidden: ["Informations de base"],
	},
});
