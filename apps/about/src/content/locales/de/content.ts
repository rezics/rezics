import { deTerminology } from "@rezics/i18n/terminology/de";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { SiteCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const API = verbatimTerms.api.value;
const OAUTH = verbatimTerms.oauth.value;
const MCP = verbatimTerms.mcp.value;
const BLOCK_SCHEMA = verbatimTerms.blockSchema.value;
const PORTABLE_TEXT = verbatimTerms.portableText.value;
const JSON = verbatimTerms.json.value;
const URL = verbatimTerms.url.value;
const GITHUB = verbatimTerms.github.value;
const REZICS_INC = verbatimTerms.rezicsInc.value;
const AGPL30 = verbatimTerms.agpl30.value;
const FOLLOW = deTerminology.follow.forms.actionLabel;
const REALM = deTerminology.realm.forms.label;

export const deContent = {
	nav: {
		home: "Startseite",
		uses: "Anwendungsfälle",
		products: "Produkte",
		enter: `Zu ${BRAND}`,
		language: "Sprache",
		theme: "Darstellung",
		openMenu: "Menü öffnen",
		closeMenu: "Menü schließen",
	},
	theme: { light: "Hell", dark: "Dunkel", toggle: "Darstellung wechseln" },
	a11y: {
		skipContent: "Zum Hauptinhalt springen",
		primaryNavigation: "Hauptnavigation",
		utilityNavigation: "Werkzeugnavigation",
		home: `${BRAND}-Startseite`,
	},
	meta: {
		home: {
			title: `${BRAND} — Den Geschichten begegnen, die du liebst`,
			description: `Webromane plattform- und sprachübergreifend finden, Serien ${deTerminology.follow.forms.action} und Gleichgesinnte in Themenräumen treffen.`,
		},
		uses: {
			title: `Anwendungsfälle — ${BRAND}`,
			description: `Entdecke, wie Lesende plattformübergreifend Bücher finden, Serien ${deTerminology.follow.forms.action}, ihren Fortschritt sichern und Gleichgesinnte treffen.`,
		},
		products: {
			title: `Produkte — ${BRAND}`,
			description: `Von Grund auf mehrsprachige Einheiten bilden die gemeinsame Grundlage; sprachübergreifende Bücherlisten, Tags und Community-Klassifikation, Wikis und ${deTerminology.realm.forms.pluralLabel} tragen Werke dann über Sprachen, Plattformen und Communities hinweg weiter.`,
		},
	},
	home: {
		eyebrow: "Weitergeben · Schaffen · Verbreiten",
		title: "Den Geschichten begegnen, die du liebst.",
		lead: `Ausgangspunkt sind Webromane, die über verschiedene Plattformen und Sprachen verstreut sind. ${BRAND} verbindet das Originalwerk und seine Darstellungen in verschiedenen Sprachen, Fortsetzungsquellen, Kapitel und Communities wieder zu einem einzigen Werk, das sich fortlaufend entwickelt.`,
		explore: "Webromane entdecken",
		productsAction: "Produkte entdecken",
		problem: {
			title:
				"Eine Serie sollte nicht durch Plattformen, Sprachen und übersetzte Titel zu Fragmenten werden.",
			body: "Lesende suchen dieselbe Geschichte, müssen sie heute jedoch immer wieder zwischen Plattformseiten, Einträgen zu übersetzten Titeln, Fortschrittswerkzeugen und Diskussionsgruppen erkennen. Wenn das Werk aktualisiert wird, ziehen diese Fragmente nicht unbedingt gemeinsam weiter.",
		},
		promise: {
			title:
				"Zuerst dasselbe Werk wieder zusammenführen; dann können Lesen und Community natürlich wachsen.",
			body: `${BRAND} nimmt eine von Grund auf mehrsprachige Einheit als gemeinsamen Ausgangspunkt. Dasselbe Werk kann mehrere Inhaltssprachen tragen, Serien können sich über Plattformen erstrecken, Kapitel können weiter wachsen und ${deTerminology.realm.forms.pluralLabel} können unterschiedliche Sichtweisen bilden; Original, Übersetzungen und Communities teilen dennoch eine verständliche und nachvollziehbare Identität.`,
		},
		principles: [
			{
				title: "Plattformübergreifend erkennen",
				body: `Eine Plattform-${URL} ist eine Quelle, nicht die einzige Identität eines Werks.`,
			},
			{
				title: "Sprachübergreifend verstehen",
				body: "Originaltitel, übersetzte Titel und Aliasnamen helfen Lesenden gemeinsam, dasselbe Werk zu finden.",
			},
			{
				title: "Fortlaufend entwickeln",
				body: "Serien, Kapitel, Ausgaben, Fortschritt und Diskussionen können sich bei Aktualisierungen des Werks weiter ansammeln.",
			},
		],
		model: {
			title:
				"Webromane sind der Einstieg; die Grundlage ist für alle Werke geschaffen, die sich fortlaufend entwickeln.",
			body: "Werk, Quellen, Inhalt, Struktur, Geschichte und Community behalten jeweils klare Grenzen und arbeiten über explizite Beziehungen zusammen.",
			steps: [
				{
					title: "Von Grund auf mehrsprachige Einheit",
					body: "Eine Werkidentität trägt von Anfang an die Darstellung jeder Sprache, sodass Namen, Inhalte und Plattformquellen nicht in unverbundene Einträge zerfallen.",
				},
				{
					title: "Quellen und Serien",
					body: `Originalserien, Übersetzungsquellen, veröffentlichte Ausgaben und Aktualisierungsstände werden nicht mehr in eine einzige ${URL} gepresst.`,
				},
				{
					title: `Lesen und ${FOLLOW}`,
					body: "Die Inhaltsstruktur bewahrt den Kapitelzusammenhang; der Fortschritt lässt Lesende an der tatsächlichen Stelle weitermachen.",
				},
				{
					title: `${REALM} und gemeinsames Wissen`,
					body: `Lesende bilden ${deTerminology.realm.forms.pluralLabel} rund um gemeinsame Interessen, damit Diskussionen, Korrekturen und Entdeckungen dauerhaft erhalten bleiben.`,
				},
			],
		},
		outcomes: {
			title:
				"Zuerst die Probleme der Lesenden von heute lösen, dann das Werknetz von morgen aufbauen.",
			body: `Das Finden, ${deTerminology.follow.forms.gerund}, der Beitritt zu einer Community und das Ergänzen einer Beziehung senken die Suchkosten für die nächste lesende Person.`,
			cards: [
				{
					title: "Finden",
					body: `Denselben Webroman über Originaltitel, Übersetzung, Aliasnamen oder Quell-${URL} finden.`,
				},
				{
					title: "Weitermachen",
					body: "Aktualisierungen der Serie verfolgen und Lesestatus sowie letzte Position speichern.",
				},
				{
					title: "Begegnen",
					body: `Einen ${REALM} betreten oder schaffen und Menschen finden, die langfristig über dasselbe Werk sprechen möchten.`,
				},
			],
		},
		open: {
			title: "Eine große Erzählung braucht eine überprüfbare Grundlage.",
			body: `${BRAND} schafft langfristig erweiterbare Grenzen durch Open Source, Inhaltsdokumente mit Versionssemantik, ${deTerminology.publicationLicense.forms.label} und berechtigte ${API}s; die Produktseiten unterscheiden dabei klar zwischen verfügbaren, in Entwicklung befindlichen und geplanten Teilen.`,
		},
		closing: {
			title: "Beginne mit einem Webroman, dem du gerade folgst.",
			body: `Suche nach seinem Originaltitel oder seiner Übersetzung, sichere deinen Lesezusammenhang und sieh nach, ob bereits jemand einen ${REALM} dafür geschaffen hat.`,
			action: `Zu ${BRAND}`,
		},
		contact: {
			title: "Hast du eine Idee, die du mit uns verwirklichen möchtest?",
			body: "Ob Produktzusammenarbeit, Mitarbeit an Open Source, ein Inhaltsmodell oder ein Vorschlag, der besser umgesetzt werden sollte: Wir freuen uns, mit dir zu sprechen.",
			action: "Kontakt aufnehmen",
		},
		v1: {
			identity: {
				title:
					"Eine Serie sollte nicht durch Plattformen, Sprachen und übersetzte Titel zu Fragmenten werden.",
				body: `Lesende suchen dieselbe Geschichte, müssen sie heute jedoch immer wieder zwischen Plattformseiten, Einträgen zu übersetzten Titeln, Fortschrittswerkzeugen und Diskussionsgruppen erkennen. ${BRAND} führt sie zunächst wieder zu einer Werkidentität zusammen.`,
				sourcesTitle: "Plattformübergreifende Quellen",
				sources: [
					"Plattformen der Originalserie",
					"Übersetzungs- und Lizenzquellen",
					"Veröffentlichte und andere Ausgaben",
				],
				namesTitle: "Original- und übersetzte Namen",
				originalName: "Originaltitel, Romanisierung und Aliasnamen",
				translatedName: "Offizielle und gebräuchliche Namen in jeder Sprache",
				updates: {
					title: "Serienaktualisierungen",
					body: "Quellen werden fortlaufend aktualisiert; die Werkidentität muss nicht neu aufgebaut werden.",
				},
				progress: {
					title: "Lesefortschritt",
					body: "Wisse, bis wohin das Werk aktualisiert wurde und bis wohin du gelesen hast.",
				},
				realm: {
					title: `${REALM}-Community für Gleichgesinnte`,
					body: "Finde über ein Werk Menschen, die langfristig darüber sprechen möchten.",
				},
				workTitle: "Ein Werk, das sich fortlaufend entwickelt",
			},
			loop: {
				title:
					"Vom Finden eines Buches zum Aufbau eines Werknetzes, das sich nicht leicht kopieren lässt.",
				body: `Ein Startkatalog mit 400.000 Büchern löst den Kaltstart; was sich wirklich weiter ansammelt, sind plattformübergreifende Identität, sprachübergreifende Beziehungen, Lesespuren und die Community-Erinnerung von ${deTerminology.realm.forms.pluralLabel}.`,
				steps: [
					{
						title: "Ein Werk plattformübergreifend finden",
						body: "Originaltitel, Übersetzungen, Aliasnamen und Quellen verweisen auf eine Identität.",
					},
					{
						title: `${FOLLOW}: Serien und Fortschritt`,
						body: "Wisse, wo du liest, wie weit die Aktualisierung ist und bis wohin du gelesen hast.",
					},
					{
						title: `Einem ${REALM} beitreten oder einen schaffen`,
						body: "Finde über ein Werk die Menschen, die wirklich langfristig darüber sprechen.",
					},
					{
						title: "Quellen und Wissen beitragen",
						body: "Namen, Ausgaben, Beziehungen und Community-Inhalte korrigieren.",
					},
					{
						title: "Suche und Empfehlungen verbessern",
						body: "Jede Beteiligung senkt die Suchkosten für die nächste lesende Person.",
					},
				],
			},
			foundation: {
				title:
					"Webromane sind der Einstieg; die Grundlage ist für alle Werke geschaffen, die sich fortlaufend entwickeln.",
				body: `${BRAND} trennt Werkidentität, Quellen, Inhalt, Struktur, Geschichte und Communities in klare Grenzen und lässt sie dann über explizite Beziehungen zusammenarbeiten.`,
				pillars: [
					{
						title: "Von Grund auf mehrsprachige Einheit",
						body: "Eine Werkidentität trägt Sprachdarstellungen, Plattformquellen, Haupteinträge/Varianten und die Governance von Zusammenführungen.",
					},
					{
						title: "Inhaltsstruktur",
						body: "Kapitel sind wiederverwendbare Inhalte; die Struktur verwaltet Reihenfolge, Auftreten und die Entwicklung einer Serie.",
					},
					{
						title: `${BLOCK_SCHEMA} + ${PORTABLE_TEXT}`,
						body: `Entwicklungsfähige Dokumente mit Typ-, Schlüssel- und Versionssemantik; Rich Text ist kein rohes ${JSON}.`,
					},
					{
						title: `${REALM} und gemeinsame Erinnerung`,
						body: "Communities besitzen Werke nicht, doch Diskussionen, Governance und Wissen können sich langfristig ansammeln.",
					},
				],
				closing:
					"Beginne mit Webromanen und baue ein Netzwerk, in dem Werke und gemeinsames Wissen weitergegeben, geschaffen und verbreitet werden können.",
			},
		},
	},
	uses: {
		eyebrow: "Lesende erhalten zuerst Nutzen",
		title:
			"Bücher finden, Aktualisierungen verfolgen, weiterlesen und dann echten Gleichgesinnten begegnen.",
		lead: `Lesende müssen nicht zuerst Inhaltseinheiten, Blöcke oder Inhaltsstruktur verstehen. Sie beginnen einfach mit einem vertrauten Titel, einer Plattform oder Sprache; ${BRAND} verbindet im Hintergrund Identität und Beziehungen.`,
		resultLabel: "Das Ergebnis",
		journeys: [
			{
				title: "Denselben Webroman plattformübergreifend finden",
				body: `Über eine Plattform-${URL}, die Originalserie, eine Übersetzungsquelle oder eine veröffentlichte Ausgabe einsteigen und zu derselben Werkidentität zurückkehren.`,
				result: "Nicht mehr jeden Plattformeintrag für ein anderes Buch halten.",
			},
			{
				title: "Es in einer vertrauten Sprache finden und verstehen",
				body: "Originaltitel, Romanisierung und gebräuchliche Namen der Community werden zu Sucheinstiegen; dieselbe Einheit zeigt anschließend Name, Zusammenfassung und Inhalt passend zu den Spracheinstellungen der lesenden Person.",
				result: "Sprachen überqueren, ohne Originalwerk oder bestehende Community zu verlassen.",
			},
			{
				title: `Einer Serie ${deTerminology.follow.forms.action} und an der letzten Stelle weitermachen`,
				body: "Sehen, bis zu welchem Kapitel eine Quelle aktualisiert ist, ob sich das Werk noch in Fortsetzung befindet oder abgeschlossen ist, und den eigenen Lesestatus sowie die letzte Position speichern.",
				result:
					"Das Werk wird aktualisiert, doch der Lesezusammenhang muss nicht von vorn beginnen.",
			},
			{
				title: `Einem ${REALM} beitreten oder einen schaffen`,
				body: `Von einer Werkseite aus einen ${REALM} betreten und langfristige Diskussionen sowie gemeinsame Regeln rund um dasselbe Werk, Genre oder Leseinteresse bilden.`,
				result: "Vom Finden eines Werks zum Finden echter Gleichgesinnter weitergehen.",
			},
			{
				title: "Quellen, Namen und Werkbeziehungen ergänzen",
				body: "Dabei helfen, Übersetzungen, Plattformquellen, Serien, Veröffentlichungen, Schaffende und Themenbeziehungen zu korrigieren, und zugleich Governance- sowie Geschichtskontext bewahren.",
				result:
					"Jede Korrektur hilft der nächsten lesenden Person, die Antwort schneller zu finden.",
			},
			{
				title: `Eigene ${deTerminology.post.forms.pluralLabel} und Werk-Inhalte veröffentlichen`,
				body: `Mit ${PORTABLE_TEXT} einen ${deTerminology.post.forms.label} bearbeiten, mit ${BLOCK_SCHEMA} entwicklungsfähige Dokumente bewahren und Kapitel sowie Veröffentlichungsgeschichte mit der Inhaltsstruktur anordnen.`,
				result:
					"Inhalt ist nicht nur lesbar, sondern kann auch zitiert, wiederverwendet und fortlaufend überarbeitet werden.",
			},
			{
				title: "Über offene Schnittstellen neue Einstiege schaffen",
				body: `Entwickelnde können derzeit über ${API} und klar abgegrenzte Tokens zugreifen; ${OAUTH}- und ${MCP}-Integrationen werden entsprechend der auf jeder Produktseite ausgewiesenen Phase schrittweise geöffnet.`,
				result: "Es ist offen sichtbar, was heute nutzbar ist und wohin der nächste Schritt führt.",
			},
		],
		closing: {
			title: "Möchtest du sehen, welche Produkte hinter diesen Anwendungsfällen zusammenarbeiten?",
			body: "Jede Produktseite beginnt mit ihrem Nutzen für Menschen und zeigt anschließend die beteiligten Produkte, ihren aktuellen Stand und ihre Beziehungen.",
			action: "Produkte entdecken",
		},
	},
	products: {
		eyebrow: "Produkte",
		title: "Werke finden, verstehen, sammeln und gemeinsam weitertragen.",
		lead: `Jedes Werk bewahrt zunächst seine Sprachdarstellungen, Beziehungen und Überarbeitungen in einer von Grund auf mehrsprachigen Einheit. Sprachübergreifende Bücherlisten, Tags und Community-Klassifikation, Wikis und ${deTerminology.realm.forms.pluralLabel} tragen es anschließend zu Lesenden und Communities anderer Sprachen.`,
		openProduct: "Produkt ansehen",
		stage: {
			legend: "Produktstatus",
			current: "Aktueller Status",
			labels: { available: "Verfügbar", development: "In Entwicklung", planned: "Geplant" },
		},
	},
	product: {
		breadcrumbHome: "Startseite",
		breadcrumbProducts: "Produkte",
		related: "Produkte, die hier zusammenwirken",
		readNext: `Dem Produktnetz weiter ${deTerminology.follow.forms.action}`,
		enter: `Zu ${BRAND}`,
	},
	footer: {
		statement:
			"Den Geschichten begegnen, die du liebst; gemeinsames Wissen weitergeben, schaffen und verbreiten.",
		explore: "Entdecken",
		project: "Projekt",
		source: `${GITHUB}-Quellcode`,
		mainSite: "Hauptwebsite",
		copyright: `© 2026 ${REZICS_INC}`,
		license: AGPL30,
	},
	notFound: {
		title: "Diese Seite wurde nicht gefunden",
		body: "Die Adresse wurde möglicherweise geändert oder dieser Inhalt existiert noch nicht.",
		back: "Zur Startseite",
	},
} satisfies SiteCopy;
