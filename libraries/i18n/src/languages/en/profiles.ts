import { insert } from "native-i18n";

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
	contentDescription: "Posts, reviews, and collections published publicly by this user.",
	contentEmpty: "There is no public content here yet.",
	contentTypes: {
		posts: "Posts",
		reviews: "Reviews",
		collections: "Collections",
	},
} satisfies typeof import("../zh-Hant/profiles").default;
