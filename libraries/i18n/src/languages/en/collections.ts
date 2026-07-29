import { insert } from "native-i18n";
import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: metadataTerms } = enTerminology.metadata;

export default {
	title: "Collections",
	favorites: "Favorites",
	newCollection: "New collection",
	createDescription: "Create a collection for organizing, presenting, and sharing content.",
	editCollection: "Manage collection",
	deleteCollection: "Delete collection",
	deleteCollectionPrompt: "The collection and its arrangement cannot be restored after deletion.",
	emptyCollections: "You have no collections yet.",
	containingUnitEmpty: "No public Collection includes this work yet.",
	emptyCollectionTitle: "This collection is empty",
	emptyCollectionBody: "Added content will appear here using the same cards as the feed.",
	contentLabel: "Collection content",
	itemCount: insert("{{count}} items", { count: Number }),
	directCollectionHint:
		"A collection is added as one item; its contents are not imported recursively.",
	save: {
		action: "Save",
		title: "Save to collections",
		directDescription: "Choose Favorites or any custom collection.",
		reviewDescription:
			"In custom collections, the review will be placed under the work it reviews.",
		favoritesDescription: "Save quickly without creating a parent-child arrangement.",
		searchLabel: "Find a collection",
		searchPlaceholder: "Enter a collection name",
		noMatches: "No matching collections.",
		noCollections: "You have no collection that can accept content yet.",
		createLabel: "Create collection",
		createPlaceholder: "Collection name",
		createAndSave: "Create and save",
		manage: "Manage collections",
		saved: "Saved",
		notSaved: "Not saved",
	},
	workspace: {
		title: "Collection management",
		description: `Manage content, ${metadataTerms.inline}, structure, presentation, access, and history.`,
		navigation: "Collection management navigation",
		overview: "Collection management areas",
		backToCollection: "Back to collection",
		backToContent: "Back to content",
		sections: {
			content: {
				label: "Content",
				description: "Edit the title, summary, and cover in each content language.",
			},
			metadata: {
				label: metadataTerms.label,
				description: `Set status and visibility ${metadataTerms.inline}, or delete the collection.`,
			},
			items: {
				label: "Content & structure",
				description: "Add, remove, order, nest, and feature content.",
			},
			presentation: {
				label: "Presentation",
				description: "Choose the content layout and ordering rule.",
			},
			access: {
				label: "Access",
				description: "Manage authorization subjects, permissions, and restrictions.",
			},
			history: {
				label: "History",
				description: "Review, compare, and restore collection revisions.",
			},
		},
	},
	items: {
		add: "Add content",
		target: "Content",
		role: "Role",
		parent: "Parent item",
		topLevel: "Top level",
		item: "Standard item",
		featured: "Featured item",
		remove: "Remove",
		moveEarlier: "Move earlier",
		moveLater: "Move later",
		saveStructure: "Update structure",
		empty: "This collection has no manageable content yet.",
	},
	presentation: {
		layout: "Layout",
		order: "Order",
		save: "Save presentation",
		layouts: {
			flat: "Single-column feed",
			nested: "Parent-child groups",
			shelf: "Card shelf",
		},
		orders: {
			manual: "Manual order",
			name: "Name",
			"added-at": "Date added",
		},
	},
	form: {
		language: "Content language",
		title: "Title",
		summary: "Summary",
		cover: "Cover",
		status: "Status",
		visibility: "Visibility",
		save: "Save changes",
	},
	cancel: "Cancel",
	delete: "Delete",
	close: "Close",
} satisfies typeof import("../zh-Hant/collections").default;
