import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const deTerminology = defineTerminology("de", {
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
	post: {
		status: "approved",
		forms: { label: "Beitrag", pluralLabel: "Beiträge", inline: "Beitrag", plural: "Beiträge" },
		forbidden: ["Post", "Posts"],
	},
});
