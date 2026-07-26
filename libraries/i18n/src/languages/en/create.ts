import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: postTerms } = enTerminology.post;
const { forms: realmTerms } = enTerminology.realm;

export default {
	workspace: {
		title: verbatimTerms.studio.value,
		description: "View and manage the content you have created.",
		backToApplication: `Back to ${verbatimTerms.rezics.value}`,
		navigation: `${verbatimTerms.studio.value} navigation`,
		overview: "Content types",
		backToOverview: "Back to content types",
	},
	sections: {
		book: { label: "Books", description: "View and create your books." },
		software: { label: "Software", description: "View and create your software entries." },
		media: { label: "Media", description: "View and create your media." },
		entity: { label: "Catalog entries", description: "View and create your catalog entries." },
		tag: { label: "Tags", description: "View and create your tags." },
		realm: {
			label: realmTerms.label,
			description: `View and create your ${realmTerms.label}.`,
		},
		post: { label: postTerms.label, description: `View and create your ${postTerms.label}.` },
		collection: { label: "Collections", description: "View and create your collections." },
		review: { label: "Reviews", description: "View and create your reviews." },
		poll: { label: "Polls", description: "View and create your polls." },
	},
	list: {
		create: "Create",
		empty: "You have not created any content of this type yet.",
		untitled: "Untitled content",
	},
	developmentBadge: "In development",
} satisfies typeof import("../zh-Hant/create").default;
