import { deTerminology } from "@rezics/i18n/terminology/de";

const content = {
	zone: deTerminology.zone.forms.label,
	blocks: "Blockkonfiguration",
	query: "Inhaltsabfrage",
	history: "History",
	preview: "Produktvorschau",
	path: `${deTerminology.zone.forms.label} / Konfiguration`,
	blockSchema: "Block-Schema",
	headerBlock: "Kopfblock",
	feedBlock: "Feed-Block · Abfrage: neueste",
	collectionBlock: "Collection-Block · Referenz",
	feedResult: "Feed-Ergebnis",
	postCard: `${deTerminology.post.forms.label}-Karte`,
	catalogResult: "Catalog-Ergebnis",
	bookCard: "Book-Karte",
	discussion: "Diskussion",
	comment: "Comment",
} satisfies typeof import("../../en/components/zone").default;

export default content;
