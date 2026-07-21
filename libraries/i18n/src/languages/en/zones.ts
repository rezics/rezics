import { insert } from "native-i18n";

import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: zoneTerms } = enTerminology.zone;

export default {
	navigation: `${zoneTerms.label} navigation`,
	openNavigation: `Open ${zoneTerms.inline} navigation`,
	openMenu: insert("Open {{label}} menu", { label: String }),
	emptyTitle: `This ${zoneTerms.inline} has no home page yet`,
	emptyBody: `The ${zoneTerms.inline} managers have not published home-page content.`,
	searchTitle: `Search this ${zoneTerms.inline}`,
	searchPlaceholder: "Enter keywords",
	searchSubmit: "Search",
	searchResults: "Search results",
	searchEmpty: "No matching content was found.",
	searchFailed: "Search is temporarily unavailable. Please try again later.",
	untitledResult: "Untitled content",
	contentList: "Content list",
} satisfies typeof import("../zh-Hant/zones").default;
