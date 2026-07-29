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
	publishers: {
		label: "Herausgeber",
		unknown: "Kein Herausgeber angegeben",
		current: "Aktuelle Herausgeber",
		currentDescription:
			"Diese Profile werden auf der Sammlungsseite und in Feeds als Herausgeber genannt.",
	},
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
		description: `Verwalte Inhalte, ${metadataTerms.inline}, Reihenfolge, Herausgeber, Zugriff und Verlauf.`,
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
					"Füge Inhalte hinzu, entferne, wähle mehrere aus, sortiere und verschachtle sie.",
			},
			publishers: {
				label: "Herausgeber",
				description: "Verwalte die öffentlich angezeigten Herausgeberprofile.",
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
		parent: "Übergeordnetes Element",
		topLevel: "Oberste Ebene",
		selectAll: "Alle geladenen Elemente auswählen",
		clearSelection: "Auswahl aufheben",
		selectedCount: insert("{{count}} Elemente ausgewählt", { count: Number }),
		selectItem: insert("{{title}} auswählen", { title: String }),
		removeItem: insert("{{title}} entfernen", { title: String }),
		move: "Verschieben",
		setAsChild: "Als untergeordnet festlegen",
		moveTitle: "Ausgewählte Elemente verschieben",
		childTitle: "Einem Element unterordnen",
		moveDescription:
			"Die relative Reihenfolge bleibt erhalten und die Änderung wird atomar ausgeführt.",
		destination: "Ziel",
		moveToStart: "An den Anfang",
		moveToEnd: "Ans Ende",
		moveAfter: "Nach einem Element",
		afterItem: "Vorheriges Element",
		chooseDestination: "Element auswählen",
		applyMove: "Verschieben",
		empty: "Diese Sammlung enthält noch keine verwaltbaren Inhalte.",
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
