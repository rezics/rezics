import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { insert } from "native-i18n";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}, ${verbatimTerms.png.value}, ${verbatimTerms.webp.value} oder ${verbatimTerms.avif.value}`;

export default {
	choose: "Bild auswählen, hierher ziehen oder einfügen",
	hint: `${SupportedImageFormats}, bis zu 10 ${verbatimTerms.mib.value}`,
	replace: "Ersetzen",
	remove: "Entfernen",
	cancel: "Abbrechen",
	invalid: `Wähle ein Bild im Format ${SupportedImageFormats} mit weniger als 10 ${verbatimTerms.mib.value}.`,
	current: "Überschreibung für die aktuelle Sprache",
	displayPreview: "Angezeigter Bereich",
	editPresentation: "Angezeigten Bereich anpassen",
	upload: {
		preparing: "Bild-Upload wird vorbereitet …",
		uploading: "Bild wird hochgeladen …",
		progress: insert("Bild wird hochgeladen … {{percentage}} %", { percentage: Number }),
		processing: "Upload abgeschlossen. Bild wird verarbeitet …",
	},
	localizationFallback: {
		notice: "Für jedes Bild gilt die Sprachersatzregel unabhängig.",
		title: "Sprachersatz für Bilder",
		description:
			"Avatar, Banner und Cover werden jeweils unabhängig von der für den Text gewählten Sprache ermittelt.",
		viewerPreferences:
			"Bilder werden in der Reihenfolge der Spracheinstellungen der jeweiligen Person gesucht. Fehlt das Bild in einer Sprache, wird mit der nächsten bevorzugten Sprache fortgefahren.",
		defaultOrder:
			"Enthält keine der bevorzugten Sprachen dieses Bild, wird die Suche in der standardmäßigen Lokalisierungsreihenfolge des Inhalts fortgesetzt.",
		noImage:
			"Wenn das Bild in keiner Lokalisierung vorhanden ist, wird kein lokalisiertes Bild zurückgegeben.",
		textDifference:
			"Für Text gilt eine andere Regel: Es wird eine vollständige Lokalisierung gewählt; Titel, Zusammenfassung und Beschreibung werden nicht feldweise aus verschiedenen Sprachen ersetzt.",
		example:
			"Bevorzugt eine Person beispielsweise Chinesisch und danach Englisch, enthält Chinesisch Text und Banner, aber keinen Avatar, und enthält Englisch einen Avatar, sieht sie chinesischen Text, das chinesische Banner und den englischen Avatar.",
		close: "Regeln zum Sprachersatz für Bilder schließen",
	},
	presentationEditor: {
		title: {
			avatar: "Avatar anpassen",
			banner: "Banner anpassen",
			cover: "Cover anpassen",
		},
		description: {
			avatar: "Verschiebe und zoome das Bild innerhalb des quadratischen Ausschnitts. Die kreisförmige Avatarvorschau entfernt die ursprünglichen Ecken nicht.",
			banner: "Verschiebe und zoome das Bild innerhalb des festen Ausschnitts im Verhältnis 4:1. Neue Banner beginnen oben links.",
			cover: "Zeige standardmäßig das vollständige Bild oder wechsle zu einem festen Ausschnitt im Verhältnis 3:4, wenn die Komposition wichtiger ist.",
		},
		close: "Bildanpassung schließen",
		loading: "Originalbild wird geladen…",
		loadFailed: "Das Originalbild oder seine Darstellung konnte nicht geladen werden.",
		cropArea:
			"Bildausschnitt. Ziehe zum Verschieben, zoome mit dem Mausrad oder verschiebe ihn mit den Pfeiltasten.",
		zoom: "Zoom",
		zoomIn: "Vergrößern",
		zoomOut: "Verkleinern",
		reset: "Zurücksetzen",
		avatarPreview: "Kreisförmige Vorschau",
		bannerPreview: "Bannervorschau",
		coverPreview: "Vorschau des vollständigen Covers",
		coverMode: {
			label: "Darstellungsmodus des Covers",
			contain: "Vollständiges Bild anzeigen",
			crop: "Auf 3:4 zuschneiden",
			containDescription:
				"Das vollständige Bild bleibt sichtbar. Bei abweichenden Proportionen verwendet der Rahmen einen unscharfen Hintergrund.",
			cropDescription: "Nur der ausgewählte 3:4-Bereich wird ausgeliefert und angezeigt.",
		},
		cancel: "Abbrechen",
		save: "Angezeigten Bereich speichern",
		saveFailed: "Der angezeigte Bereich konnte nicht gespeichert werden. Versuche es erneut.",
	},
	avatarPicker: {
		setup: "Avatar einrichten",
		edit: "Avatar bearbeiten",
		dialogTitle: "Avatar auswählen",
		dialogDescription: "Lade ein Bild hoch oder wähle ein Symbol oder Emoji.",
		close: "Avatarauswahl schließen",
		source: "Avatarquelle",
		useInherited: "Übernommenen Avatar verwenden",
		recent: "Zuletzt verwendet",
		typeLabel: "Avatartyp",
		tabs: { image: "Bild", icon: "Symbol", emoji: "Emoji" },
		preview: "Avatarvorschau",
		icon: {
			search: "Symbole suchen",
			featured: "Häufig verwendete Symbole",
			style: "Symbolstil",
			styles: { fas: "Ausgefüllt", fab: "Marken" },
			loading: "Symbole werden gesucht…",
			empty: "Keine passenden Symbole gefunden.",
			failed: "Symbole können derzeit nicht durchsucht werden. Versuche es später erneut.",
			select: insert("Symbol auswählen: {{name}}", { name: String }),
			unconfigured: `${verbatimTerms.fontAwesome.value} ${verbatimTerms.cdn.value} ist nicht konfiguriert. Daher können keine Symbolvorschauen angezeigt werden.`,
		},
		emoji: {
			search: "Emojis suchen",
			skinTone: "Hautton ändern",
			loading: "Emojis werden geladen…",
			empty: "Keine passenden Emojis gefunden.",
		},
	},
	bannerPreview: {
		description: "Das ausgelieferte Banner verwendet den gespeicherten 4:1-Bereich.",
		showOriginal: "Vollständiges Bild anzeigen",
		hideOriginal: "Vollständiges Bild ausblenden",
		original: "Vollständiges Bild",
	},
	roles: {
		avatar: {
			title: "Avatar",
			inherit: "Den ersten verfügbaren Avatar in der Lokalisierungsreihenfolge verwenden",
			failed: "Der Avatar konnte nicht hochgeladen werden. Versuche es erneut.",
		},
		banner: {
			title: "Banner",
			inherit: "Das erste verfügbare Banner in der Lokalisierungsreihenfolge verwenden",
			failed: "Das Banner konnte nicht hochgeladen werden. Versuche es erneut.",
		},
		cover: {
			title: "Cover",
			inherit: "Das erste verfügbare Cover in der Lokalisierungsreihenfolge verwenden",
			failed: "Das Cover konnte nicht hochgeladen werden. Versuche es erneut.",
		},
	},
} satisfies typeof import("../zh-Hant/media").default;
