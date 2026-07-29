import { insert } from "native-i18n";

import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: postTerms } = enTerminology.post;
const { forms: realmTerms } = enTerminology.realm;

export default {
	memberSince: insert("Joined {{date}}", { date: String }),
	editProfile: "Edit profile",
	tabsLabel: "Profile pages",
	tabs: {
		profile: "Profile",
		activity: "Activity",
		content: "Content",
	},
	aboutTitle: "About",
	aboutEmpty: "This user has not added a detailed introduction yet.",
	activityTitle: "Scores and Progress",
	activityDescription:
		"Visible Scores and current Progress appear here according to the item and overall privacy settings.",
	activityEmpty: "There are no visible Scores or Progress records yet.",
	activityScores: "Scores",
	activityProgress: "Progress",
	activityScoreRealm: insert(`${realmTerms.label}: {{realm}}`, { realm: String }),
	activityScoreValue: insert("{{value}} / 10", { value: Number }),
	activityProgressValue: insert("{{percentage}}%", { percentage: Number }),
	progressStatuses: {
		backlog: "Not started",
		active: "In progress",
		paused: "Paused",
		completed: "Completed",
		dropped: "Dropped",
	},
	contentTitle: "Published content",
	contentDescription: `Public ${postTerms.pluralLabel} and reviews credited to this user, plus collections and catalog entries they own.`,
	contentEmptyTitle: "No public content yet",
	contentEmptyDescription: "Public content published or owned by this user will appear here.",
} satisfies typeof import("../zh-Hant/profiles").default;
