import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: postTerms } = enTerminology.post;
const { forms: realmTerms } = enTerminology.realm;

export default {
	title: "Create",
	description: "Choose the type of content to create.",
	items: {
		book: "Book",
		software: "Software",
		media: "Media",
		entity: "Catalog entry",
		tag: "Tag",
		realm: realmTerms.label,
		post: postTerms.label,
		collection: "Collection",
		review: "Review",
		poll: "Poll",
	},
} satisfies typeof import("../zh-Hant/create").default;
