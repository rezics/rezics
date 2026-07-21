import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	versions: "Versions",
	publishedVersions: "Published versions",
	fieldHistory: "Field history",
	diff: "Field diff",
	locked: "This field is locked within the active editing scope",
	bookTitle: String(verbatimTerms.bookTitleField.value),
	postBlock: String(verbatimTerms.postBlockField.value),
	zoneConfig: String(verbatimTerms.zoneConfigField.value),
	publishedVersionC: "Published version C",
	publishedVersionB: "Published version B",
	publishedVersionA: "Published version A",
	current: "current",
	previous: "previous",
	initial: "initial",
	previousTitle: "Previous title",
	currentTitle: "Current published title",
	postBlockHistory: "Post block history",
	previousPostBlock: `${verbatimTerms.paragraphBlockField.value} / published B`,
	currentPostBlock: `${verbatimTerms.paragraphBlockField.value} / published C`,
	zoneConfigurationHistory: "Zone configuration history",
	previousZoneQuery: `${verbatimTerms.feedQueryField.value} / published A`,
	currentZoneQuery: `${verbatimTerms.feedQueryField.value} / published B`,
};

export default content;
