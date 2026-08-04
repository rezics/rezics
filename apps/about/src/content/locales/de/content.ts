import { deTerminology } from "@rezics/i18n/terminology/de";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { SiteCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const API = verbatimTerms.api.value;
const OAUTH = verbatimTerms.oauth.value;
const GITHUB = verbatimTerms.github.value;
const REZICS_INC = verbatimTerms.rezicsInc.value;
const AGPL30 = verbatimTerms.agpl30.value;

export const deContent = {
	nav: {
		home: "Start",
		how: "So funktioniert es",
		uses: "Anwendungen",
		products: "Funktionen",
		enter: `${BRAND} öffnen`,
		language: "Sprache",
		theme: "Darstellung",
		openMenu: "Menü öffnen",
		closeMenu: "Menü schließen",
	},
	theme: { light: "Hell", dark: "Dunkel", toggle: "Darstellung wechseln" },
	a11y: {
		skipContent: "Zum Hauptinhalt",
		primaryNavigation: "Hauptnavigation",
		utilityNavigation: "Werkzeuge",
		home: `${BRAND} Startseite`,
	},
	meta: {
		home: {
			title: `${BRAND} — Geschichten wiederbegegnen`,
			description:
				"Eine Werkidentität verbindet Veröffentlichungen, Inhalte, Communities und Wissen über Sprachen hinweg.",
		},
		how: {
			title: `So funktioniert es — ${BRAND}`,
			description:
				"Von der Werkidentität zu verbundenen Inhalten, Verläufen und Communities.",
		},
		uses: {
			title: `Anwendungen — ${BRAND}`,
			description:
				"Wie Lesende, Communities, Schaffende und Entwicklungsteams dasselbe Werknetz nutzen.",
		},
		products: {
			title: `Funktionen — ${BRAND}`,
			description:
				"Das vollständige Modell für Werke, Inhalte, Communities und offene Zugänge.",
		},
	},
	home: {
		eyebrow: "Erben · Schaffen · Weitertragen",
		title: "Geschichten wiederbegegnen.",
		lead: `${BRAND} ist eine von Grund auf mehrsprachige Plattform für die Organisation und Veröffentlichung von Inhalten sowie die Zusammenarbeit in Communities. Werke, ${deTerminology.metadata.forms.inline}, ${deTerminology.post.forms.plural}, Sammlungen, Kategorien und Community-Räume erhalten jeweils eine beständige Identität und lassen sich im selben System verknüpfen, erstellen, verwalten, entdecken, diskutieren und gemeinschaftlich regeln.`,
		explore: "Anwendungen entdecken",
		understand: "Das Modell verstehen",
		problem: {
			title: "Wir lieben dasselbe Werk und finden doch nur Fragmente.",
			body: "Sprachen, Ausgaben, Medienformen und Communities führen getrennte Einträge. Lesende identifizieren dasselbe Werk immer wieder, Zuordnungen verblassen und Wissen überlebt den Plattformwechsel kaum.",
		},
		promise: {
			title: "Zuerst das Werk erkennen, dann Wissen darum wachsen lassen.",
			body: `${BRAND} beginnt mit einer stabilen Werkidentität. Namen können übersetzt, Inhalte verändert und Community-Sichten neu geordnet werden, ohne den gemeinsamen Gegenstand zu verlieren.`,
		},
		principles: [
			{
				title: "Erben",
				body: "Geschichte, Sprachen, Ausgaben und Community-Erinnerungen, die ein Werk bereits mitbringt.",
			},
			{
				title: "Schaffen",
				body: "Inhalte schreiben, Strukturen bilden, Zuordnungen festhalten und Verständnis schaffen.",
			},
			{
				title: "Weitertragen",
				body: "Wissen durch Communities, offene Protokolle und Sprachverbindungen weitertragen.",
			},
		],
		model: {
			title: "Eine Identität wird Schicht für Schicht zu vollständigem Kontext.",
			body: "Das Modell trennt Bedeutungen, die nicht vermischt werden dürfen, und verbindet sie ausdrücklich.",
			steps: [
				{
					title: "Werkidentität",
					body: "Das Werk hat einen stabilen Kern unabhängig von Sprache und Darstellung.",
				},
				{
					title: "Veröffentlichungen und Beziehungen",
					body: `Serien, Veröffentlichungen, ${deTerminology.entity.forms.pluralLabel}, Tags und Zuordnungen schaffen realen Kontext.`,
				},
				{
					title: "Inhalt und Verlauf",
					body: "Inhaltsstruktur, Bearbeitung und Verlauf erhalten Reihenfolge, Änderung und Wiederverwendung.",
				},
				{
					title: "Menschen und Communities",
					body: `Sammlungen, ${deTerminology.realm.forms.pluralLabel}, ${deTerminology.zone.forms.pluralLabel} und Feeds machen das Modell erlebbar.`,
				},
			],
		},
		outcomes: {
			title: "Für Lesende und für die Werke selbst.",
			body: "Dieselbe Grundlage erleichtert das Finden, schützt kreative Zuordnung und bringt Werke mit den passenden Lesenden zusammen.",
			cards: [
				{
					title: "Finden",
					body: "Werke, Ausgaben und Schaffende sprachübergreifend erkennen.",
				},
				{
					title: "Verstehen",
					body: "Struktur, Rezensionen, Wikis, Verlauf und Beziehungen als Kontext lesen.",
				},
				{
					title: "Fortsetzen",
					body: "Fortschritt bewahren, Communities beitreten und Erfahrung zu gemeinsamem Gedächtnis machen.",
				},
			],
		},
		open: {
			title: "Offenheit lässt Gedächtnis weiterleben.",
			body: `${BRAND} verbindet externe Werkzeuge durch offenen Quellcode, portable Inhalte, Veröffentlichungslizenzen und berechtigte ${API}s.`,
		},
		closing: {
			title: "Mit einem Werk beginnen, das wichtig ist.",
			body: "Werke, Communities und wachsendes Wissen im Hauptangebot entdecken.",
			action: `${BRAND} öffnen`,
		},
		contact: {
			title: "Eine Idee, die wir gemeinsam verwirklichen können?",
			body: "Ob Produktkooperation, Mitarbeit am Open-Source-Projekt, Fragen zum Inhaltsmodell oder Vorschläge für Verbesserungen – wir freuen uns auf den Austausch.",
			action: "Kontakt aufnehmen",
		},
	},
	how: {
		eyebrow: "Vom Fundament",
		title: "Kein größerer Katalog, sondern eine Methode für verbundene Werke.",
		lead: `${BRAND} baut Identität, Darstellung, Beziehungen, Inhalte, Vertrauen und Entdeckung nacheinander auf. Jede Schicht bewahrt eine Bedeutung und kann so Sprachen, Medien und Communities verbinden.`,
		stages: [
			{
				title: "1. Werkidentität",
				body: `Eine stabile ${verbatimTerms.id.value} erkennt das Werk; lokalisierte Namen und Typmetadaten entwickeln sich, ohne ein neues Werk anzulegen.`,
			},
			{
				title: "2. Darstellung und Typ",
				body: "Bücher, Medien und Software behalten eigene Felder und Erlebnisse und teilen Identität und Beziehungen.",
			},
			{
				title: "3. Beziehungen und Zuordnung",
				body: `Serien, Veröffentlichungen, ${deTerminology.entity.forms.pluralLabel}, Tags, kreative Zuordnung und Themenbezüge bilden ein verständliches Netz.`,
			},
			{
				title: "4. Inhaltsblöcke und Inhaltsstruktur",
				body: "Inhaltsblöcke beschreiben darstellbare Inhalte; die Inhaltsstruktur verwaltet Vorkommen, Reihenfolge, Wiederverwendung und Verzweigung.",
			},
			{
				title: "5. Verlauf, Lizenz und Governance",
				body: "Veröffentlichungsgrenzen erzeugen nachvollziehbare Versionen; Lizenzen, Zugriff und Governance erklären Rechte und Vertrauen.",
			},
			{
				title: "6. Entdeckungsflächen",
				body: `Suche, Feeds, ${deTerminology.realm.forms.pluralLabel} und ${deTerminology.zone.forms.pluralLabel} schaffen Wege zum Finden, Lesen, Mitmachen und Wiederkommen.`,
			},
		],
		integrity: {
			title: "Bedeutungen trennen, zu Wert verbinden.",
			body: "Identität ist kein Titel, Veröffentlichung keine Serie, Inhaltsblock kein Strukturknoten und ein Community-Raum besitzt nicht jedes referenzierte Werk.",
		},
		interfaceTitle: "Dasselbe Modell erscheint in einer echten Produktoberfläche.",
		interfaceBody: `Die öffentliche ${BRAND}-Seite eines Themenraums verbindet Suche, Community-Kontext, Feed und Werkzugänge. Das Bild enthält keine persönlichen Kontodaten.`,
		screenshotAlt: `Öffentliche ${BRAND}-Themenraumseite mit Navigation, Suche, Überschrift und offiziellen Inhaltskarten.`,
		screenshotCaption: `Öffentliche Produktoberfläche · offizieller ${BRAND}-${deTerminology.realm.forms.label}`,
	},
	uses: {
		eyebrow: "Beim Bedarf beginnen",
		title: "Ein Werknetz, viele reale Wege.",
		lead: `Lesende müssen das Datenmodell nicht zuerst lernen. Sie suchen ein Buch, ${deTerminology.follow.forms.action} einer Serie, treten einer Community bei oder sichern Fortschritt; die Verbindungen erscheinen bei Bedarf.`,
		resultLabel: "Ergebnis",
		journeys: [
			{
				title: "Dasselbe Werk in mehreren Sprachen finden",
				body: "Mit Übersetzung, Originaltitel, Schaffenden, Veröffentlichung oder Medienform beginnen und Beziehungen schrittweise erkennen.",
				result: "Ein verlässlicher Einstieg statt wiederholter Suche.",
			},
			{
				title: "Ausgaben und kreativen Kontext verstehen",
				body: `Serien, Veröffentlichungen, ${deTerminology.entity.forms.pluralLabel}, Figuren, Schaffende und Verlage getrennt und verbunden sehen.`,
				result: "Verstehen, was vorliegt und woher es kommt.",
			},
			{
				title: "Lesen und beitragen",
				body: `Buchstruktur, ${deTerminology.post.forms.pluralLabel}, Wikis, Bilder, Rezensionen und Bewertungen lesen und eigenes Wissen ergänzen.`,
				result: "Inhalte bleiben mit dem erklärten Werk verbunden.",
			},
			{
				title: "Einer Interessengemeinschaft beitreten",
				body: `Gemeinsame Regeln im ${deTerminology.realm.forms.inline}, kuratierte Sichten im ${deTerminology.zone.forms.inline} und fortlaufende Gespräche im Feed.`,
				result: "Community-Wissen wird mehr als ein vergänglicher Nachrichtenstrom.",
			},
			{
				title: "Sammeln, zurückkehren und fortsetzen",
				body: "Werke in Sammlungen und Bibliotheken ordnen, Fortschritt speichern und später in denselben Kontext zurückkehren.",
				result: "Persönliche Wege und gemeinsames Wissen stützen einander.",
			},
			{
				title: "Mit Zuordnung und Bedingungen veröffentlichen",
				body: `Inhalte strukturieren, ${deTerminology.post.forms.pluralLabel} zuordnen, Veröffentlichungslizenzen wählen und Verlauf bewahren.`,
				result: "Werke bleiben verständlich und nutzbar, ohne ihre Herkunft zu verlieren.",
			},
			{
				title: "Werkzeuge und neue Zugänge bauen",
				body: `${API}, ${OAUTH} und begrenzte Token verbinden Suche, Bearbeitung und Community-Abläufe mit denselben Identitäten.`,
				result: "Integrationen erweitern das Netz statt neue Datensilos zu schaffen.",
			},
		],
		closing: {
			title: "Wie greifen alle Funktionen ineinander?",
			body: "Die Referenz führt von Werkidentität bis zu offenen Schnittstellen und erklärt Wert, Ablauf, Beziehungen und Grenzen.",
			action: "Alle Funktionen ansehen",
		},
	},
	products: {
		eyebrow: "Vollständige Referenz",
		title: "Von Werkidentität zum offenen Ökosystem.",
		lead: "26 Funktionen sind nach ihrer Rolle im Modell geordnet. Keine lose Funktionssammlung, sondern ein Weg vom Erkennen eines Werks zum dauerhaften gemeinsamen Wissen.",
		searchLabel: "Funktionen suchen",
		searchPlaceholder: "Name oder Zweck",
		allLayers: "Alle",
		empty: "Keine passende Funktion.",
		openProduct: "Funktion ansehen",
		layers: {
			identity: {
				title: "Identität und Beziehungen",
				body: `Werke erkennen und Veröffentlichungen, Serien, ${deTerminology.entity.forms.pluralLabel} und Klassifikation verbinden.`,
			},
			form: {
				title: "Inhaltsformen",
				body: "Lesen, Anschauen, Schaffen, Bewerten und Antworten tragen.",
			},
			structure: {
				title: "Struktur und Gedächtnis",
				body: "Inhalt bilden und Veröffentlichung, Unterschiede und Entwicklung bewahren.",
			},
			community: {
				title: "Menschen und Communities",
				body: `Sammeln, kuratieren, diskutieren, ${deTerminology.follow.forms.action} und zurückkehren.`,
			},
			open: {
				title: "Offenes Ökosystem",
				body: "Werkzeuge, Dienste und neue Zugänge mit klaren Rechten verbinden.",
			},
		},
	},
	product: {
		breadcrumbHome: "Start",
		breadcrumbProducts: "Funktionen",
		layerLabel: "Schicht",
		related: "Verwandte Funktionen",
		readNext: "Weiterlesen",
		enter: `${BRAND} öffnen`,
	},
	footer: {
		statement: "Geschichten wiederbegegnen und Wissen erben, schaffen und weitertragen.",
		explore: "Entdecken",
		project: "Projekt",
		source: `${GITHUB}-Quellcode`,
		mainSite: "Hauptseite",
		copyright: `© 2026 ${REZICS_INC}`,
		license: AGPL30,
	},
	notFound: {
		title: "Seite nicht gefunden",
		body: "Die Adresse hat sich geändert oder der Inhalt existiert nicht.",
		back: "Zur Startseite",
	},
} satisfies SiteCopy;
