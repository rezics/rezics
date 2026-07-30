import { insert } from "native-i18n";

import { enTerminology } from "@rezics/i18n/terminology/en";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

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
	card: {
		open: insert("Open the {{tag}} Tag card ({{context}})", {
			tag: String,
			context: String,
		}),
		close: "Close Tag card",
		globalContext: "Global Tags",
		structureContext: tagStructureTerms.label,
		policy: `${realmTerms.label}-set`,
		search: "Search this Tag",
		details: "View Tag details",
	},
	selection: {
		start: "Select multiple",
		finish: "Finish selecting",
		add: "Add to selection",
		remove: "Remove from selection",
		addNamed: insert("Select {{tag}}", { tag: String }),
		removeNamed: insert("Deselect {{tag}}", { tag: String }),
		selectedCount: insert("{{count}} Tags selected", { count: Number }),
		search: "Search selected Tags",
		clear: "Clear selection",
	},
	basic: {
		title: "Basic Tags",
		description: `Global Tags and ${tagStructureTerms.pluralLabel}, without contextual judgments from any ${realmTerms.label}.`,
	},
	voteContext: {
		title: "Vote by context",
		description: `Choose Global or a ${realmTerms.label} you can contribute to. The list, scores, and your votes use that context.`,
		select: "Choose a voting context",
	},
	details: {
		title: "Other Tag contexts",
		description: `Global Tags and your selected ${realmTerms.label} sources keep their own contexts. The active voting context is not repeated here.`,
		empty: "No other Tag sources are selected.",
	},
	structures: {
		title: tagStructureTerms.pluralLabel,
		description: `${tagStructureTerms.pluralLabel} preserve meaningful hierarchy and are shown before flat Tags.`,
		addTitle: `Add a ${tagStructureTerms.inline}`,
		addDescription: `Search accepted ${tagStructureTerms.plural} first. Adding one supports the path and every Tag on it.`,
		add: `Add ${tagStructureTerms.label}`,
		create: `Create ${tagStructureTerms.label}`,
		details: `View ${tagStructureTerms.label}`,
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
	create: {
		noResults: insert("No Tag matches “{{query}}”.", { query: String }),
		inStudio: insert(`Create “{{query}}” in ${verbatimTerms.studio.value}`, {
			query: String,
		}),
		title: "Create a Tag",
		description: "Create a reusable global Tag after checking the existing Tags.",
		voteDescription:
			"Create this Tag, then return to the work and record a “Fits” vote in the current context.",
		backToUnitTags: "Back to the work’s Tags",
		backToStudioTags: `Back to Tags in ${verbatimTerms.studio.value}`,
		submit: "Create Tag",
		submitAndVote: "Create Tag and vote “Fits”",
		applying: "Tag created. Recording your vote…",
		partialTitle: "Tag created, vote not recorded",
		partialDescription:
			"The Tag was created, but it could not be applied to the work or receive your vote. You can safely retry without creating another Tag.",
		retryVote: "Retry vote",
		returnToUnitTags: "Return to the work’s Tags",
		completed: "The Tag was created and your “Fits” vote was recorded.",
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
	management: {
		title: "Tag curation",
		addSectionTitle: "Add Tags",
		addSectionDescription:
			"Open the Tag page to find and apply Tags. Adding and voting do not require Tag curation access.",
		addSectionAction: "Add Tags",
		description:
			"Choose which global Tags appear first. All other Tags keep their community-ranked order.",
		featuredTitle: "Featured Tags",
		featuredDescription:
			"Featured Tags appear first in the order you set. Drag them or use the move buttons.",
		rankedTitle: "Community-ranked Tags",
		rankedDescription: "Other global Tags remain ordered automatically by community voting.",
		feature: "Feature",
		unfeature: "Remove from featured",
		moveEarlier: "Move earlier",
		moveLater: "Move later",
		drag: insert("Drag {{tag}} to reorder", { tag: String }),
		instructions:
			"Press Space to pick up a featured Tag. Use the arrow keys to move it, then press Space again to drop it.",
		pickedUp: insert("Picked up {{tag}}.", { tag: String }),
		over: insert("{{tag}} is over position {{position}} of {{count}}.", {
			tag: String,
			position: Number,
			count: Number,
		}),
		cancelled: insert("Cancelled moving {{tag}}.", { tag: String }),
		featuredAnnouncement: insert("Featured {{tag}} at position {{position}}.", {
			tag: String,
			position: Number,
		}),
		unfeaturedAnnouncement: insert("Removed {{tag}} from featured Tags.", {
			tag: String,
		}),
		movedAnnouncement: insert("Moved {{tag}} to position {{position}}.", {
			tag: String,
			position: Number,
		}),
		noFeatured: "No featured Tags yet.",
		noRanked: "There are no other global Tags to feature.",
	},
	realms: {
		title: `${realmTerms.label} Tag contexts`,
		description: `Each ${realmTerms.inline} is an independent context. Its judgments are never merged with global Tags or another ${realmTerms.inline}.`,
		addTitle: `Add a Tag vote in this ${realmTerms.label}`,
		addDescription: `Search existing Tags first. Adding one casts a “Fits” vote in this ${realmTerms.inline}.`,
		add: "Add vote",
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
		signIn: "Sign in to vote",
		signInDescription: "Sign in to vote in the global Tag context.",
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
