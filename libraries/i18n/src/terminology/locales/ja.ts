import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const jaTerminology = defineTerminology("ja", {
	zone: {
		status: "approved",
		forms: { label: "ゾーン", pluralLabel: "ゾーン", inline: "ゾーン", plural: "ゾーン" },
		forbidden: ["Zone", "Zones"],
	},
	realm: {
		status: "approved",
		forms: { label: "領域", pluralLabel: "領域", inline: "領域", plural: "領域" },
		forbidden: ["Realm", "Realms"],
	},
	post: {
		status: "approved",
		forms: { label: "投稿", pluralLabel: "投稿", inline: "投稿", plural: "投稿" },
		forbidden: ["Post", "Posts"],
	},
});
