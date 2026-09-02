import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: postTerms } = enTerminology.post;
const { forms: realmTerms } = enTerminology.realm;
const { forms: entityTerms } = enTerminology.entity;
const { forms: zoneTerms } = enTerminology.zone;

export default {
	workspace: {
		title: verbatimTerms.studio.value,
		description: "View content you can edit now or public work you contributed to before.",
		backToApplication: `Back to ${verbatimTerms.rezics.value}`,
		navigation: `${verbatimTerms.studio.value} navigation`,
		overview: "Content types",
		backToOverview: "Back to content types",
	},
	mode: {
		label: "Content list",
		options: {
			workspace: "Your workspace",
			contributions: "Your contributions",
		},
	},
	entityHelp: {
		label: "Learn about credits",
		title: "Credit guidance",
		description: `Credits must link to an ${entityTerms.inline}. If you cannot find an ${entityTerms.inline}, or want to create an author identity for yourself, create an ${entityTerms.inline} first.`,
		createEntity: `Create an ${entityTerms.inline}`,
		close: "Close",
	},
	sections: {
		book: { label: "Books", description: "View and manage books related to your work." },
		software: {
			label: "Software",
			description: "View and manage software entries related to your work.",
		},
		media: { label: "Media", description: "View and manage media related to your work." },
		entity: {
			label: entityTerms.pluralLabel,
			description: `View and manage ${entityTerms.plural} related to your work.`,
		},
		tag: { label: "Tags", description: "View and manage tags related to your work." },
		realm: {
			label: realmTerms.label,
			description: `View and manage ${realmTerms.label} related to your work.`,
		},
		zone: {
			label: zoneTerms.label,
			description: `View and manage ${zoneTerms.label} related to your work.`,
		},
		post: {
			label: postTerms.label,
			description: `View and manage ${postTerms.label} related to your work.`,
		},
		wiki: {
			label: "Wiki articles",
			description: "View and manage wiki articles you maintain.",
		},
		collection: {
			label: "Collections",
			description: "View and manage collections related to your work.",
		},
		review: { label: "Reviews", description: "View and manage reviews related to your work." },
		poll: { label: "Polls", description: "View and manage polls related to your work." },
	},
	realmTagContext: {
		label: `${realmTerms.label} Tag explanation`,
		description: `Create this ${realmTerms.label}'s Wiki explanation of a Tag.`,
	},
	communityUnitSearch: {
		policyTitle: "Search before creating",
		policy:
			"To maintain a healthy community, search before creating a public entry and confirm that the content you want to create does not already exist. Misuse of the ability to create public entries may result in penalties.",
		confirmationLabel: insert(
			"I checked the existing {{subject}} and confirmed that this entry does not already exist.",
			{ subject: String },
		),
		prompt: insert("Search existing {{subject}}", { subject: String }),
		pageTitle: insert("Search existing {{subject}}", { subject: String }),
		pageDescription: insert("Check whether the {{subject}} you want to create already exists.", {
			subject: String,
		}),
		backToSection: insert("Back to {{subject}}", { subject: String }),
		searchLabel: insert("Search {{subject}}", { subject: String }),
		searchPlaceholder: insert("Enter the name of the {{subject}}", { subject: String }),
		searchAction: "Search",
		searchHint: "Enter a name to search for possible existing entries.",
		searchFailed: "Search is temporarily unavailable. Retry or return to the creation form.",
		resultsTitle: "Possible existing entries",
		noResultsTitle: insert("No matching {{subject}} found", { subject: String }),
		noResultsDescription:
			"After checking that the search terms are correct, you can continue to creation.",
		realmTagContextOnly: `Only Tags formally explained by this ${realmTerms.label} appear here. Ask a ${realmTerms.label} manager to add a Tag explanation if one is missing.`,
		notListedTitle: "None of these results match?",
		notListedDescription:
			"Review similar entries first. Continue only when none of them is the content you need.",
		createAction: "Continue to create",
		subjects: {
			book: "books",
			software: "software entries",
			media: "media entries",
			person: "people",
			organization: "organizations",
			character: "characters",
			tag: "tags",
		},
	},
	list: {
		create: "Create",
		empty: {
			workspace: "No editable content matches the current filters.",
			contributions: "No public contributions match the current filters.",
		},
		untitled: "Untitled content",
		immutable: "Immutable",
		contributionCount: insert("Contributions: {{count}}", { count: Number }),
		activity: {
			visited: "Visited",
			assigned: "Assigned",
			created: "Created",
			participated: "Contributed",
		},
	},
	filters: {
		sourceLabel: "Workspace source",
		kindLabel: "Contribution type",
		statusLabel: "Content status",
		visibilityLabel: "Visibility",
		any: "Any",
		more: "More filters",
		clear: "Clear filters",
		cancel: "Cancel",
		apply: "Apply filters",
		sources: {
			all: "All editable content",
			owned: "Owned by me",
			direct: "Assigned directly",
			delegated: "Team delegated",
		},
		kinds: {
			all: "All contributions",
			created: "Created by me",
			contributed: "Edited by me",
		},
		statuses: { draft: "Draft", published: "Published", archived: "Archived" },
		visibilities: { public: "Public", unlisted: "Unlisted", private: "Private" },
	},
	relations: {
		owner: "Owner",
		direct: "Assigned directly",
		realm: "Team delegated",
		created: "Creator",
		contributed: "Contributor",
	},
	developmentBadge: "In development",
} satisfies typeof import("../zh-Hant/create").default;
