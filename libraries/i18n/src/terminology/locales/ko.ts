import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const koTerminology = defineTerminology("ko", {
	zone: {
		status: "approved",
		forms: { label: "구역", pluralLabel: "구역", inline: "구역", plural: "구역" },
		forbidden: ["Zone", "Zones"],
	},
	realm: {
		status: "approved",
		forms: { label: "영역", pluralLabel: "영역", inline: "영역", plural: "영역" },
		forbidden: ["Realm", "Realms"],
	},
	post: {
		status: "approved",
		forms: { label: "게시물", pluralLabel: "게시물", inline: "게시물", plural: "게시물" },
		forbidden: ["Post", "Posts"],
	},
});
