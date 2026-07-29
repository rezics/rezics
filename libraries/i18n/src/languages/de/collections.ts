import { insert } from "native-i18n";
import { deTerminology } from "@rezics/i18n/terminology/de";

const { forms: metadataTerms } = deTerminology.metadata;

export default {
	title: "Sammlungen",
	favorites: "Favoriten",
	newCollection: "Neue Sammlung",
	createDescription:
		"Erstelle eine Sammlung, um Inhalte zu ordnen, zu präsentieren und zu teilen.",
	editCollection: "Sammlung verwalten",
	deleteCollection: "Sammlung löschen",
	deleteCollectionPrompt:
		"Die Sammlung und ihre Anordnung können nach dem Löschen nicht wiederhergestellt werden.",
	emptyCollections: "Du hast noch keine Sammlungen.",
	containingUnitEmpty: "Noch keine öffentliche Sammlung enthält dieses Werk.",
	emptyCollectionTitle: "Diese Sammlung ist leer",
	emptyCollectionBody: "Hinzugefügte Inhalte erscheinen hier in denselben Karten wie im Feed.",
	contentLabel: "Sammlungsinhalt",
	itemCount: insert("{{count}} Elemente", { count: Number }),
	directCollectionHint:
		"Eine Sammlung wird als einzelnes Element hinzugefügt; ihre Inhalte werden nicht rekursiv übernommen.",
	save: {
		action: "Speichern",
		title: "In Sammlungen speichern",
		directDescription: "Wähle Favoriten oder eine eigene Sammlung.",
		reviewDescription:
			"In eigenen Sammlungen wird die Rezension unter dem Werk eingeordnet, das sie bespricht.",
		favoritesDescription:
			"Speichere schnell, ohne eine über- und untergeordnete Struktur anzulegen.",
		searchLabel: "Sammlung suchen",
		searchPlaceholder: "Namen einer Sammlung eingeben",
		noMatches: "Keine passenden Sammlungen.",
		noCollections: "Du hast noch keine Sammlung, die Inhalte aufnehmen kann.",
		createLabel: "Sammlung erstellen",
		createPlaceholder: "Name der Sammlung",
		createAndSave: "Erstellen und speichern",
		manage: "Sammlungen verwalten",
		saved: "Gespeichert",
		notSaved: "Nicht gespeichert",
	},
	workspace: {
		title: "Sammlungsverwaltung",
		description: `Verwalte Inhalte, ${metadataTerms.inline}, Struktur, Darstellung, Zugriff und Verlauf.`,
		navigation: "Navigation der Sammlungsverwaltung",
		overview: "Bereiche der Sammlungsverwaltung",
		backToCollection: "Zurück zur Sammlung",
		backToContent: "Zurück zum Inhalt",
		sections: {
			content: {
				label: "Inhalt",
				description: "Bearbeite Titel, Zusammenfassung und Cover für jede Inhaltssprache.",
			},
			metadata: {
				label: metadataTerms.label,
				description: `Lege Status- und Sichtbarkeits-${metadataTerms.inline} fest oder lösche die Sammlung.`,
			},
			items: {
				label: "Inhalt und Struktur",
				description:
					"Füge Inhalte hinzu, entferne, sortiere, verschachtel und hebe sie hervor.",
			},
			presentation: {
				label: "Darstellung",
				description: "Wähle das Inhaltslayout und die Sortierregel.",
			},
			access: {
				label: "Zugriff",
				description: "Verwalte Berechtigungssubjekte, Rechte und Einschränkungen.",
			},
			history: {
				label: "Verlauf",
				description: "Prüfe, vergleiche und stelle Versionen der Sammlung wieder her.",
			},
		},
	},
	items: {
		add: "Inhalt hinzufügen",
		target: "Inhalt",
		role: "Rolle",
		parent: "Übergeordnetes Element",
		topLevel: "Oberste Ebene",
		item: "Standardelement",
		featured: "Hervorgehobenes Element",
		remove: "Entfernen",
		moveEarlier: "Nach vorne verschieben",
		moveLater: "Nach hinten verschieben",
		saveStructure: "Struktur aktualisieren",
		empty: "Diese Sammlung enthält noch keine verwaltbaren Inhalte.",
	},
	presentation: {
		layout: "Layout",
		order: "Reihenfolge",
		save: "Darstellung speichern",
		layouts: {
			flat: "Einspaltiger Feed",
			nested: "Über- und untergeordnete Gruppen",
			shelf: "Kartenregal",
		},
		orders: {
			manual: "Manuelle Reihenfolge",
			name: "Name",
			"added-at": "Hinzugefügt am",
		},
	},
	form: {
		language: "Inhaltssprache",
		title: "Titel",
		summary: "Zusammenfassung",
		cover: "Cover",
		status: "Status",
		visibility: "Sichtbarkeit",
		save: "Änderungen speichern",
	},
	cancel: "Abbrechen",
	delete: "Löschen",
	close: "Schließen",
} satisfies typeof import("../zh-Hant/collections").default;
