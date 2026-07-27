import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: postTerms } = enTerminology.post;
const { forms: realmTerms } = enTerminology.realm;
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
			label: "Catalog entries",
			description: "View and manage catalog entries related to your work.",
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
	list: {
		create: "Create",
		empty: "No content matches the current filters.",
		untitled: "Untitled content",
	},
	filters: {
		viewLabel: "Work relationship",
		permissionLabel: "Current permission",
		workStateLabel: "Work state",
		statusLabel: "Content status",
		visibilityLabel: "Visibility",
		sortLabel: "Sort order",
		any: "Any",
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
