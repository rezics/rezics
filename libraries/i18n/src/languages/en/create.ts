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
		description: "View content you created, maintained, or were assigned to manage.",
		backToApplication: `Back to ${verbatimTerms.rezics.value}`,
		navigation: `${verbatimTerms.studio.value} navigation`,
		overview: "Content types",
		backToOverview: "Back to content types",
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
		policy: "To maintain a healthy community, search before creating a public entry and confirm that the content you want to create does not already exist. Misuse of the ability to create public entries may result in penalties.",
		requiredTitle: "Check existing entries first",
		requiredDescription: "Complete a search before submitting this public entry.",
		prompt: insert("Search existing {{subject}}", { subject: String }),
		confirmedTitle: insert("Existing {{subject}} searched", { subject: String }),
		confirmedDescription:
			"This title has been searched. Changing the title or kind requires another search.",
		pageTitle: insert("Search existing {{subject}}", { subject: String }),
		pageDescription: insert(
			"Check whether the {{subject}} you want to create already exists.",
			{
				subject: String,
			},
		),
		backToSection: insert("Back to {{subject}}", { subject: String }),
		searchLabel: insert("Search {{subject}}", { subject: String }),
		searchPlaceholder: insert("Enter the name of the {{subject}}", { subject: String }),
		searchAction: "Search",
		searchHint: "Enter a name and run the search to make the creation option available.",
		searchFailed: "Search is temporarily unavailable. Retry before creating a public entry.",
		resultsTitle: "Possible existing entries",
		noResultsTitle: insert("No matching {{subject}} found", { subject: String }),
		noResultsDescription:
			"After checking that the search terms are correct, you can continue to creation.",
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
		empty: "No content matches the current filters.",
		untitled: "Untitled content",
		contributionCount: insert("Contributions: {{count}}", { count: Number }),
		activity: {
			visited: "Visited",
			updated: "Updated",
			created: "Created",
			relevant: "Relevant",
		},
	},
	filters: {
		viewLabel: "Work relationship",
		permissionLabel: "Current permission",
		workStateLabel: "Work state",
		statusLabel: "Content status",
		visibilityLabel: "Visibility",
		sortLabel: "Sort order",
		any: "Any",
		more: "More filters",
		clear: "Clear filters",
		cancel: "Cancel",
		apply: "Apply filters",
		views: {
			all: "My work",
			created: "Created by me",
			contributed: "Contributed by me",
			assigned: "Assigned directly",
			delegated: "Team delegated",
		},
		permissions: {
			"unit.update": "Can edit",
			"unit.status.update": "Can change status",
			"unit.access.manage": "Can manage access",
			"unit.realm-publication.manage": `Can manage ${realmTerms.label} publication`,
		},
		workStates: { actionable: "Actionable", blocked: "Currently blocked" },
		statuses: { draft: "Draft", published: "Published", archived: "Archived" },
		visibilities: { public: "Public", unlisted: "Unlisted", private: "Private" },
		sorts: {
			recent: "Recently visited",
			updated: "Recently updated",
			created: "Recently created",
			relevant: "Recently relevant",
		},
	},
	relations: {
		created: "Creator",
		contributed: "Contributor",
		assigned: "Directly assigned",
		delegated: "Team delegated",
		blocked: "Currently blocked",
	},
	developmentBadge: "In development",
} satisfies typeof import("../zh-Hant/create").default;
