import { insert } from "native-i18n";

import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: realmTerms } = enTerminology.realm;
const { forms: followTerms } = enTerminology.follow;
const { forms: tagStructureTerms } = enTerminology.tagStructure;

export default {
	page: {
		title: "Tags",
		description:
			"Review global Tags and the contextual judgments made by the Tag sources you selected.",
		viewAll: "View full Tag page",
		manageOnTagPage: `Add Tags and ${tagStructureTerms.pluralLabel} on the dedicated Tag page so their voting context stays visible.`,
	},
	structures: {
		title: tagStructureTerms.pluralLabel,
		description: `${tagStructureTerms.pluralLabel} preserve meaningful hierarchy and are shown before flat Tags.`,
		addTitle: `Add a ${tagStructureTerms.inline}`,
		addDescription: `Search accepted ${tagStructureTerms.plural} first. Adding one supports the path and every Tag on it.`,
		add: `Add ${tagStructureTerms.label}`,
		create: `Create ${tagStructureTerms.label}`,
		empty: `This work has no accepted ${tagStructureTerms.plural} yet.`,
		memberFallback: "Unnamed Tag",
		pathLabel: `Ordered ${tagStructureTerms.label}`,
	},
	detail: {
		childrenTitle: "Direct child Tags",
		childrenDescription: `These relationships come from accepted, community-locked ${tagStructureTerms.pluralLabel}. Each child shows its direct children.`,
		noChildren: "This Tag has no accepted direct children yet.",
		grandchildrenTitle: "Direct children",
	},
	createStructure: {
		title: `Create ${tagStructureTerms.label}`,
		description:
			"Build an ordered path from broader to more specific Tags. Community members cannot edit it after creation; platform administrators may make audited corrections.",
		pick: "Choose the next Tag",
		addMember: "Add to path",
		removeMember: "Remove from path",
		moveEarlier: "Move earlier",
		moveLater: "Move later",
		preview: "Community-locked path preview",
		minimum: "Add at least two distinct Tags.",
		submit: `Create ${tagStructureTerms.label} and vote`,
	},
	adminEditStructure: {
		title: `Correct ${tagStructureTerms.label}`,
		description:
			"Platform administrators can correct the members or order. The Unit identity, votes, and applications are preserved, and the correction is recorded in history.",
		reasonLabel: "Correction reason",
		reasonPlaceholder: "Explain why this administrative correction is necessary.",
		submit: "Save audited correction",
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
	unnamedStructure: `Unnamed ${tagStructureTerms.label}`,
} satisfies typeof import("../zh-Hant/tags").default;
