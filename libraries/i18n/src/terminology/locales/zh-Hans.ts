import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const zhHansTerminology = defineTerminology("zh-Hans", {
	zone: {
		status: "approved",
		forms: { label: "专区", pluralLabel: "专区", inline: "专区", plural: "专区" },
		forbidden: ["Zone", "Zones"],
	},
	realm: {
		status: "approved",
		forms: { label: "领域", pluralLabel: "领域", inline: "领域", plural: "领域" },
		forbidden: ["Realm", "Realms"],
	},
	post: {
		status: "approved",
		forms: { label: "帖子", pluralLabel: "帖子", inline: "帖子", plural: "帖子" },
		forbidden: ["Post", "Posts"],
	},
});
