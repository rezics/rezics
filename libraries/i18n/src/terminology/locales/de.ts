import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const deTerminology = defineTerminology("de", {
	follow: {
		status: "approved",
		forms: {
			actionLabel: "Folgen",
			action: "folgen",
			stateLabel: "Gefolgt",
			gerund: "Folgen",
			followed: "gefolgt",
			undoActionLabel: "Nicht mehr folgen",
			undoAction: "nicht mehr folgen",
			follower: "Follower",
			collectionLabel: "Gefolgt",
		},
		forbidden: ["Abonnieren", "Abonnement", "Subscribe", "Subscription"],
	},
	zone: {
		status: "approved",
		forms: {
			label: "Community-Bereich",
			pluralLabel: "Community-Bereiche",
			inline: "Community-Bereich",
			plural: "Community-Bereiche",
		},
		forbidden: ["Zone", "Zones"],
	},
	realm: {
		status: "approved",
		forms: {
			label: "Themenraum",
			pluralLabel: "Themenräume",
			inline: "Themenraum",
			plural: "Themenräume",
		},
		forbidden: ["Realm", "Realms"],
	},
	dock: {
		status: "approved",
		forms: {
			label: "Ablagebereich",
			pluralLabel: "Ablagebereiche",
			inline: "Ablagebereich",
			plural: "Ablagebereiche",
		},
		forbidden: ["Dock", "Docks"],
	},
	unitSlug: {
		status: "approved",
		forms: {
			label: "Pfadkennung",
			pluralLabel: "Pfadkennungen",
			inline: "Pfadkennung",
			plural: "Pfadkennungen",
		},
		forbidden: ["Slug", "slug"],
	},
	post: {
		status: "approved",
		forms: { label: "Beitrag", pluralLabel: "Beiträge", inline: "Beitrag", plural: "Beiträge" },
		forbidden: ["Post", "Posts"],
	},
	video: {
		status: "approved",
		forms: { label: "Video", pluralLabel: "Videos", inline: "Video", plural: "Videos" },
		forbidden: [],
	},
	audio: {
		status: "approved",
		forms: { label: "Audio", pluralLabel: "Audios", inline: "Audio", plural: "Audios" },
		forbidden: [],
	},
	label: {
		status: "approved",
		forms: {
			label: "Taxonomiebezeichnung",
			pluralLabel: "Taxonomiebezeichnungen",
			inline: "Taxonomiebezeichnung",
			plural: "Taxonomiebezeichnungen",
		},
		forbidden: [],
	},
	tagPath: {
		status: "approved",
		forms: {
			label: "Tag-Pfad",
			pluralLabel: "Tag-Pfade",
			inline: "Tag-Pfad",
			plural: "Tag-Pfade",
		},
		forbidden: ["Tag structure", "Structure tag"],
	},
	license: {
		status: "approved",
		forms: { label: "Lizenz", inline: "Lizenz" },
		forbidden: [],
	},
	entity: {
		status: "approved",
		forms: {
			label: "Entität",
			pluralLabel: "Entitäten",
			inline: "Entität",
			plural: "Entitäten",
		},
		forbidden: ["Catalog"],
	},
	metadata: {
		status: "approved",
		forms: { label: "Metadaten", inline: "Metadaten" },
		forbidden: ["Grundinformationen"],
	},
});
