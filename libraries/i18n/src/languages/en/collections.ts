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
	publishers: {
		label: "Publisher",
		unknown: "No publisher credited",
		current: "Current publishers",
		currentDescription:
			"These Profiles receive publisher credit on the collection page and in feeds.",
	},
	save: {
		action: "Save",
		title: "Save to collections",
		directDescription:
			"Choose Favorites or a custom collection. When saving a Review to a custom collection, its subject is added first if needed.",
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
		description: `Manage content, ${metadataTerms.inline}, ordering, publishers, access, and history.`,
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
				label: "Content & order",
				description: "Add, remove, multi-select, and order content.",
			},
			publishers: {
				label: "Publishers",
				description: "Manage the Profile publisher credits shown publicly.",
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
		selectAll: "Select all loaded items",
		clearSelection: "Clear selection",
		selectedCount: insert("{{count}} items selected", { count: Number }),
		selectItem: insert("Select {{title}}", { title: String }),
		removeItem: insert("Remove {{title}}", { title: String }),
		move: "Move",
		moveTitle: "Move selected items",
		moveDescription:
			"The relative order of selected items is preserved and the change is applied atomically.",
		destination: "Destination",
		moveToStart: "Move to beginning",
		moveToEnd: "Move to end",
		moveAfter: "Move after an item",
		afterItem: "Previous item",
		chooseDestination: "Choose an item",
		applyMove: "Apply move",
		empty: "This collection has no manageable content yet.",
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
