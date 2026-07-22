import { insert } from "native-i18n";

import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: postTerms } = enTerminology.post;

export default {
	memberSince: insert("Joined {{date}}", { date: String }),
	editProfile: "Edit profile",
	tabsLabel: "Profile pages",
	tabs: {
		profile: "Profile",
		content: "Content",
	},
	aboutTitle: "About",
	aboutEmpty: "This user has not added a detailed introduction yet.",
	contentTitle: "Published content",
	contentDescription: `Public ${postTerms.pluralLabel} and reviews credited to this user, plus collections and catalog entries they own.`,
	contentEmpty: "There is no public content here yet.",
	contentTypes: {
		entity: "Owned catalog entries",
		posts: postTerms.pluralLabel,
		reviews: "Reviews",
		collections: "Collections",
	},
} satisfies typeof import("../zh-Hant/profiles").default;
