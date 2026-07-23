import { insert } from "native-i18n";

import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: realmTerms } = enTerminology.realm;
const { forms: followTerms } = enTerminology.follow;

export default {
	page: {
		title: "Tags",
		description:
			"Review global Tags and the contextual judgments made by the Tag sources you selected.",
		viewAll: "View full Tag page",
	},
	global: {
		title: "Global Tags",
		description: "Global Tags are proposed and judged by everyone with interaction access.",
		addTitle: "Add a global Tag",
		addDescription: "Search existing Tags first. Adding one also casts a “Fits” vote.",
		add: "Add Tag",
		pinned: "Pinned",
		empty: "This work has no global Tags yet.",
	},
	realms: {
		title: `${realmTerms.label} Tag contexts`,
		description: `Each ${realmTerms.inline} is an independent context. Its judgments are never merged with global Tags or another ${realmTerms.inline}.`,
		policy: `${realmTerms.label}-set Tags`,
		votes: `${realmTerms.label} member votes`,
		context: "View voting context",
		empty: "Your selected Tag sources have not judged this work yet.",
		cannotVote: `Join this ${realmTerms.inline} to participate in its contextual vote.`,
	},
	vote: {
		fits: "Fits",
		doesNotFit: "Does not fit",
		clear: "Remove my judgment",
		summary: insert("Net {{score}} · {{count}} votes", {
			score: String,
			count: String,
		}),
	},
	sources: {
		title: "Tag sources",
		description: `Choose and order the ${realmTerms.plural} shown in work Tag areas. This does not ${followTerms.action} a work or change ${realmTerms.inline} membership.`,
		addTitle: "Add a Tag source",
		addDescription: `Search readable ${realmTerms.plural} and add one to your personal Tag source list.`,
		add: "Add source",
		remove: "Remove source",
		moveEarlier: "Move earlier",
		moveLater: "Move later",
		empty: "No Tag sources selected.",
		manage: "Manage Tag sources",
	},
	unnamedTag: "Unnamed Tag",
	unnamedRealm: `Unnamed ${realmTerms.label}`,
} satisfies typeof import("../zh-Hant/tags").default;
