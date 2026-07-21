import { deTerminology } from "@rezics/i18n/terminology/de";

const content = {
	consumers: "Nutzende Produkte",
	zone: deTerminology.zone.forms.label,
	realm: deTerminology.realm.forms.label,
	home: "Home",
	zoneFeed: `Feed des ${deTerminology.zone.forms.label}s`,
	realmFeed: `Feed des ${deTerminology.realm.forms.label}s`,
	homeFeed: "Startseiten-Feed",
	postCard: `${deTerminology.post.forms.label}-Karte`,
	bookCard: "Book-Karte",
	commentCard: "Comment-Karte",
	kindAware: "typbewusst",
	catalog: "Katalog",
	discussion: "Diskussion",
	consumerConfiguration: "Konfiguration des nutzenden Produkts",
	query: "Abfrage",
	consumerScope: "Nutzungsbereich",
	card: "Karte",
	perFeature: "pro Funktion",
	order: "Reihenfolge",
	feedOrder: "Feed-Reihenfolge",
} satisfies typeof import("../../en/components/feed").default;

export default content;
