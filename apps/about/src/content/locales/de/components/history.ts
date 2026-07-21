import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	versions: "Versionen",
	publishedVersions: "Veröffentlichte Versionen",
	fieldHistory: "Feldverlauf",
	diff: "Felddifferenz",
	locked: "Dieses Feld ist im aktiven Bearbeitungsbereich gesperrt",
	bookTitle: verbatimTerms.bookTitleField.value,
	postBlock: verbatimTerms.postBlockField.value,
	zoneConfig: verbatimTerms.zoneConfigField.value,
	publishedVersionC: "Veröffentlichte Version C",
	publishedVersionB: "Veröffentlichte Version B",
	publishedVersionA: "Veröffentlichte Version A",
	current: "aktuell",
	previous: "vorherig",
	initial: "initial",
	previousTitle: "Vorheriger Titel",
	currentTitle: "Aktuell veröffentlichter Titel",
	postBlockHistory: "Verlauf des Post-Blocks",
	previousPostBlock: `${verbatimTerms.paragraphBlockField.value} / veröffentlicht B`,
	currentPostBlock: `${verbatimTerms.paragraphBlockField.value} / veröffentlicht C`,
	zoneConfigurationHistory: "Verlauf der Zone-Konfiguration",
	previousZoneQuery: `${verbatimTerms.feedQueryField.value} / veröffentlicht A`,
	currentZoneQuery: `${verbatimTerms.feedQueryField.value} / veröffentlicht B`,
} satisfies typeof import("../../en/components/history").default;

export default content;
