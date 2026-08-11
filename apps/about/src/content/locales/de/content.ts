import { deTerminology } from "@rezics/i18n/terminology/de";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { SiteCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const API = verbatimTerms.api.value;
const OAUTH = verbatimTerms.oauth.value;
const MCP = verbatimTerms.mcp.value;
const AI = verbatimTerms.ai.value;
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
		how: "So funktioniert es",
		uses: "Anwendungsfälle",
		products: "Fähigkeitsübersicht",
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
		how: {
			title: `So funktioniert es — ${BRAND}`,
			description: `Erfahre, wie ${BRAND} Quellen über Plattformen hinweg mit einer gemeinsamen Werkidentität verbindet und unterschiedliche Kontexte durch Sprache, ${deTerminology.realm.forms.pluralLabel}, Tag-Abstimmungen und persönliche Bereiche bewahrt.`,
		},
		uses: {
			title: `Anwendungsfälle — ${BRAND}`,
			description: `Entdecke, wie Lesende plattformübergreifend Bücher finden, Serien ${deTerminology.follow.forms.action}, ihren Fortschritt sichern und Gleichgesinnte treffen.`,
		},
		products: {
			title: `Fähigkeitskarte — ${BRAND}`,
			description: `Unterscheide bei Werk-, Inhalts-, Community- und offenen Fähigkeiten von ${BRAND} zwischen bereits verfügbar, in Entwicklung und geplant.`,
		},
	},
	home: {
		eyebrow: "Weitergeben · Schaffen · Verbreiten",
		title: "Den Geschichten begegnen, die du liebst.",
		lead: `Ausgangspunkt sind Webromane, die über verschiedene Plattformen und Sprachen verstreut sind. ${BRAND} verbindet Originaltitel, Übersetzungen, Fortsetzungsquellen, Kapitel und Communities wieder zu einem einzigen Werk, das sich fortlaufend entwickelt.`,
		explore: "Webromane entdecken",
		understand: `${BRAND} verstehen`,
		problem: {
			title:
				"Eine Serie sollte nicht durch Plattformen, Sprachen und übersetzte Titel zu Fragmenten werden.",
			body: "Lesende suchen dieselbe Geschichte, müssen sie heute jedoch immer wieder zwischen Plattformseiten, Einträgen zu übersetzten Titeln, Fortschrittswerkzeugen und Diskussionsgruppen erkennen. Wenn das Werk aktualisiert wird, ziehen diese Fragmente nicht unbedingt gemeinsam weiter.",
		},
		promise: {
			title:
				"Zuerst dasselbe Werk wieder zusammenführen; dann können Lesen und Community natürlich wachsen.",
			body: `${BRAND} nimmt eine stabile Werkidentität als gemeinsamen Ausgangspunkt. Namen können Sprachgrenzen überqueren, Serien können sich über Plattformen erstrecken, Kapitel können weiter wachsen und ${deTerminology.realm.forms.pluralLabel} können unterschiedliche Sichtweisen bilden; dennoch verweisen alle auf dasselbe verständliche und nachvollziehbare Werk.`,
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
					title: "Werkidentität",
					body: "Sprachübergreifende Namen und plattformübergreifende Quellen führen zu einer einzigen verwaltbaren Identität zurück.",
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
			body: `${BRAND} schafft langfristig erweiterbare Grenzen durch Open Source, Inhaltsdokumente mit Versionssemantik, ${deTerminology.publicationLicense.forms.label} und berechtigte ${API}s; die Fähigkeitskarte unterscheidet dabei klar zwischen verfügbaren, in Entwicklung befindlichen und geplanten Teilen.`,
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
			focus: {
				label: "Version eins beginnt jetzt",
				items: [
					"Startkatalog | die ersten 400.000 Bücher",
					"Plattformübergreifende Quellen",
					"Sprachübergreifende Werkidentität",
					`${REALM}-Communities für Gleichgesinnte`,
				],
			},
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
						title: "Werkidentität und Quellen",
						body: "Sprachübergreifende Namen, Plattformquellen, Haupteinträge/Varianten und Governance von Zusammenführungen.",
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
	how: {
		eyebrow: "Wie ein Werknetz entsteht",
		title:
			"Dasselbe Werk kann Plattformen und Sprachen überqueren und in verschiedenen Communities neu verstanden werden.",
		lead: `${BRAND} lässt zunächst Werke, Quellen und Beziehungen auf eine gemeinsame Identität verweisen; anschließend ordnet es sprachliche Darstellung, ${REALM}-Kontext, Tag-Abstimmungen und persönliche Vorlieben wieder ihren jeweiligen Bereichen zu. Gemeinsam Genutztes muss nicht dupliziert werden, und Unterschiede, die erhalten bleiben sollen, werden nicht zu einer einzigen Antwort für die gesamte Plattform plattgedrückt.`,
		stages: [
			{
				title: "1. Plattformübergreifende Werkidentität",
				body: "Originalserien, Übersetzungsquellen, Lizenzplattformen und veröffentlichte Ausgaben bleiben unterschiedlich, können jedoch zu demselben verwaltbaren Werknetz zurückführen.",
			},
			{
				title: "2. Gemeinsames Modell und sprachliche Darstellung",
				body: "Werke, Leselisten, Reihenfolgen und Beziehungen gehen über Sprachen hinaus; Namen, Zusammenfassungen und Inhalte erscheinen in der Sprache der Lesenden.",
			},
			{
				title: `3. Bereich des ${REALM}s`,
				body: `Dieselbe Einheit kann mehrere ${deTerminology.realm.forms.pluralLabel} betreten; jede Community verwaltet ihre eigenen Veröffentlichungsbeziehungen, Regeln und Kurationen, erwirbt jedoch kein Eigentum am ursprünglichen Inhalt.`,
			},
			{
				title: "4. Tags + Abstimmungen",
				body: `Globale Urteile, Urteile im ${REALM}, Policy-Tags und persönliche Ordnung bleiben jeweils getrennt erhalten; Klassifikation muss sich nicht als einzige Wahrheit ausgeben.`,
			},
			{
				title: `5. ${BLOCK_SCHEMA} und ${PORTABLE_TEXT}`,
				body: "Dokumente, Inhalt, Auftretensorte, Reihenfolge und Veröffentlichungsgeschichte haben jeweils eigene Grenzen, damit lange Serien und gemeinsames Wissen sich fortlaufend entwickeln können.",
			},
			{
				title: "6. Von der Entdeckung zum gemeinsamen Aufbau",
				body: "Finden, Lesen, der Beitritt zu einer Community und das Ergänzen von Wissen bilden einen Kreislauf, sodass jede Beteiligung die Suchkosten für die nächste lesende Person senkt.",
			},
		],
		integrity: {
			title: "Gemeinsame Identität bedeutet nicht, alle Unterschiede einzuebnen.",
			body: `Werke und Quellen brauchen eine gemeinsame Grundlage; ${deTerminology.realm.forms.pluralLabel} brauchen ihren eigenen Governance- und Abstimmungskontext; persönlicher Fortschritt und persönliche Ordnung gehören nur der jeweiligen Person. Das Ziel von ${BRAND} ist nicht, alle Daten in einer Antwort zu konzentrieren, sondern jede Art von Antwort im richtigen Bereich zu belassen und sie dennoch über dasselbe Werknetz miteinander zu verbinden.`,
		},
		v1: {
			scope: {
				title:
					"Zuerst klar unterscheiden, was geteilt werden muss und was unterschiedlich bleiben soll.",
				body: `Dasselbe Werk kann Plattformen, Sprachen und Communities überqueren, doch verschiedene Ebenen haben verschiedene Befugnisse. Diese Grenzen bestimmen, ob Daten wiederverwendet werden können und ob ${deTerminology.realm.forms.pluralLabel} sowie Einzelpersonen echte Autonomie behalten.`,
				layers: [
					{
						title: "Gemeinsame Ebene",
						body: "Plattform- und sprachübergreifend auf dieselbe nachvollziehbare Werkgrundlage verweisen.",
						items: [
							"Stabile Identitäten von Werken, Personen, Serien und Tags",
							"Plattformquellen, Ausgaben, Serien und andere explizite Beziehungen",
							"Namen, Zusammenfassungen und wiederverwendbare Inhaltsstruktur in jeder Sprache",
						],
					},
					{
						title: `Bereich des ${REALM}s`,
						body: "Communities schaffen rund um gemeinsame Objekte ihre eigenen Veröffentlichungsbeziehungen, Governance und Klassifikationssichtweisen.",
						items: [
							`Veröffentlichungs- und Ablagebeziehungen einer Einheit in einen ${REALM}`,
							"Regeln, Inhaltsgovernance, Wikis, Navigation und Kuration",
							`Tag-Kontext, Abstimmungen und Reihenfolge im ${REALM}`,
						],
					},
					{
						title: "Persönliche Ebene",
						body: "Verändert nur die eigene Art zu lesen und zu organisieren, ohne sich als öffentliche Tatsache auszugeben.",
						items: [
							"Präferenzen für Oberflächen- und Inhaltssprache",
							`Lesefortschritt, Sammlungen und ${deTerminology.follow.forms.stateLabel}-Status`,
							"Persönliche Tags und Urteile, die nur der Person selbst gehören",
						],
					},
				],
			},
			mechanisms: {
				title: "Fünf ineinandergreifende Kernmechanismen",
				body: "Jeder löst ein anderes Problem; erst zusammen schaffen sie langfristige sprachübergreifende Entdeckung, Community-Kuration und gemeinsame Governance.",
				exampleLabel: "Konkretes Szenario",
				ruleLabel: "Unveränderliche Grenze",
				capabilityLabel: "Zugehörige Fähigkeit und aktueller Status",
				items: [
					{
						title: "Ein Werk wird nicht länger von Plattformen zerteilt",
						body: `Ein Webroman kann zugleich als Originalserie, auf Übersetzungs- und Lizenzplattformen, als veröffentlichte Ausgabe und in anderen Quellen bestehen. ${BRAND} behandelt keine Plattform als Grenze eines Werks, sondern bewahrt Quellenbelege an jedem Einstieg und verbindet ihn mit einer stabilen Identität.`,
						points: [
							`Eine stabile ${verbatimTerms.id.value} hängt nicht von einer einzelnen ${URL}, einem Titel oder einer Sprache ab`,
							"Beziehungen zwischen Haupteintrag und Variante bewahren Ausgabenunterschiede, ohne so zu tun, als seien alle Einträge vollkommen gleich",
							"Quellen zeigen, wo ein Werk erscheint, und ersetzen keinen Nachweis von Identität oder Eigentum",
						],
						example: {
							title: "Eine Serie, über drei Einstiege gefunden",
							body: "Lesende können über die Originalserie, eine chinesische Übersetzungsquelle oder eine veröffentlichte Ausgabe einsteigen; jeder Einstieg bewahrt seine eigenen Informationen und führt zugleich zum Quellen-, Ausgaben- und Community-Kontext desselben Werks zurück.",
						},
						rule: `Eine Plattform-${URL} ist eine Quelle, nicht die einzige Identität eines Werks; dass ein Werk zitiert oder veröffentlicht wird, bedeutet nicht, dass das Eigentum übergeht.`,
					},
					{
						title: "Gemeinsames Modell, getrennte Darstellung je Sprache",
						body: "Werkidentität, Mitglieder einer Leseliste, Kurationsreihenfolge und Beziehungen sind nicht an eine Sprache gebunden; Originaltitel, Übersetzungen, Zusammenfassungen und Inhalte werden dagegen getrennt nach Sprache gepflegt. Oberflächensprache und Präferenzen für Inhaltssprache entscheiden zudem jeweils über unterschiedliche Dinge.",
						points: [
							"Das Modell bewahrt Werke, Beziehungen, Gruppierungen und Reihenfolge",
							"Lokalisierung bewahrt Namen, Zusammenfassungen und sprachlich angemessene Inhalte",
							"Die Oberflächensprache steuert Bedienungstexte, die Inhaltspräferenz Darstellung und Fallback-Reihenfolge",
						],
						example: {
							title: "Eine japanische Leseliste bleibt für chinesische Lesende wertvoll",
							body: "Die erstellende Person kuratiert Werkidentitäten und Reihenfolge. Wenn chinesische Lesende dieselbe Leseliste öffnen, sehen sie die vorhandenen chinesischen Namen und Zusammenfassungen; nur bei fehlender Lokalisierung fällt sie auf andere Sprachen zurück, ohne Werke, Reihenfolge oder Quellen zu verlieren.",
						},
						rule: "Eine neue chinesische Lokalisierung vervollständigt dasselbe gemeinsame Modell; eine separate chinesische Leseliste muss nicht dupliziert werden.",
					},
					{
						title: `${REALM}-Bereich: unterschiedliche Community-Kontexte auf gemeinsamer Grundlage`,
						body: `Dasselbe Werk oder eine andere Einheit kann mehrere ${deTerminology.realm.forms.pluralLabel} betreten. Jeder ${REALM} hat eigene Mitglieder, Regeln, Inhaltsaktivität, Wikis, Navigation, Kuration und Governance-Kontext, doch weder wird das gemeinsame Objekt dadurch kopiert, noch wechselt sein Eigentümer.`,
						points: [
							`Dieselbe Einheit kann gleichzeitig in mehreren ${deTerminology.realm.forms.pluralLabel} veröffentlicht werden`,
							`Jeder ${REALM} verwaltet Beziehungsstatus, Regeln und Darstellung getrennt`,
							`Das Entfernen einer Beziehung im ${REALM} löscht weder das ursprüngliche Werk noch den ${deTerminology.post.forms.label}`,
						],
						example: {
							title:
								"Dasselbe Werk kann von verschiedenen Communities unterschiedlich verstanden werden",
							body: `Ein ${REALM} zur Übersetzungsforschung kann Übersetzungen und Quellen ordnen; ein ${REALM} für Genreliebhaber kann thematische Kuration und Diskussionsregeln schaffen. Beide beziehen sich auf dasselbe Werk, müssen jedoch nicht dasselbe Community-Urteil teilen.`,
						},
						rule: `Ein ${REALM} regiert Veröffentlichungsbeziehungen und Community-Kontext und erwirbt nicht deshalb Eigentum am ursprünglichen Inhalt, weil dieser darin erscheint.`,
					},
					{
						title: "Tags + Abstimmungen: Klassifikation ist ein Urteil mit Bereich",
						body: `Ein Tag selbst ist eine lokalisierbare, produktübergreifend wiederverwendbare Identität; ob ein bestimmtes Tag zutrifft, können globale Community, ein bestimmter ${REALM}, Governance-Verantwortliche oder Einzelpersonen jeweils getrennt ausdrücken. So kann Klassifikation Konsens bilden und dennoch Kontextunterschiede aufnehmen.`,
						points: [
							"Globale Community-Abstimmungen: sammeln das Urteil der gesamten Plattform",
							`Kontextabstimmungen im ${REALM}: gelten nur in den Regeln und der Reihenfolge dieser Community`,
							`Policy-Tags im ${REALM}: werden direkt von Governance-Verantwortlichen gepflegt`,
							"Persönliche Tags: dienen nur der eigenen Art zu organisieren",
						],
						example: {
							title:
								"„Isekai“ kann gemeinsamer Wortschatz sein und zugleich ein Community-Urteil haben",
							body: `Tag-Name und mehrsprachige Erklärung können gemeinsam genutzt werden; ob ein Werk dieses Tag trägt, kann getrennt als Ergebnis globaler und ${REALM}-Abstimmungen erscheinen. Auch Einzelpersonen können eigene Tags nutzen, ohne sie als öffentliche Tatsache auszugeben.`,
						},
						rule: `Globale Abstimmungen dürfen nicht mit Abstimmungen im ${REALM} zusammengeführt werden; Anheften oder Policy-Urteile durch Governance-Verantwortliche zählen ebenfalls nicht als zustimmende Community-Stimmen.`,
					},
					{
						title: `${BLOCK_SCHEMA} + ${PORTABLE_TEXT}: Inhalte können sich fortlaufend entwickeln`,
						body: `${BRAND} modelliert Dokumentinhalt, den Ort des Auftretens von Inhalt, Kapitelreihenfolge und Veröffentlichungsgeschichte getrennt. Der ${PORTABLE_TEXT}-Editor erzeugt direkt strukturierten Rich Text; ${BLOCK_SCHEMA} gibt Blöcken Typen, stabile Schlüsselwerte, Versionen und Validierungsgrenzen.`,
						points: [
							`${BLOCK_SCHEMA} verwendet geschlossene Blocktypen und lässt unbekannte Inhalte nicht stillschweigend durch`,
							`Der ${PORTABLE_TEXT}-Editor erzeugt validierbare, zitierbare strukturierte Inhalte`,
							"Die Inhaltsstruktur ordnet Auftretensorte und Reihenfolge an, die Geschichte bewahrt veröffentlichte Revisionen",
						],
						example: {
							title: "Der Fließtext ist ein Inhalt, die Kapitelposition eine andere Beziehung",
							body: "Dasselbe Kapitel kann durch die Inhaltsstruktur an der richtigen Stelle angeordnet und bei Bedarf wiederverwendet werden; eine Änderung der Inhaltsverzeichnisreihenfolge erfordert keine Kopie des Fließtexts, während Veröffentlichung und Wiederherstellung die Geschichte über explizite Revisionen bewahren.",
						},
						rule: "Der Editor erzeugt und validiert Dokumente; Inhaltseinheiten besitzen den Fließtext; die Inhaltsstruktur ordnet Auftretensorte an; die Veröffentlichungsgeschichte bewahrt nachvollziehbare Revisionen.",
					},
				],
			},
			loop: {
				title: "Diese Mechanismen führen letztlich in denselben Kreislauf",
				body: "Die ersten 400.000 Bücher schaffen einen zugänglichen Ausgangspunkt; was wirklich weiter wächst, sind die Verbindungen zwischen Werkidentität, sprachübergreifenden Beziehungen, Community-Kontext und gemeinsamen Urteilen.",
				steps: [
					{
						title: "Plattform- und sprachübergreifend entdecken",
						body: "Über einen vertrauten Namen oder eine Quelle dasselbe Werk finden.",
					},
					{
						title: `Lesen, sammeln und ${FOLLOW}`,
						body: "Eigenen Fortschritt und langfristiges Interesse bewahren.",
					},
					{
						title: `Einem ${REALM} beitreten oder einen schaffen`,
						body: "Einen passenden Community-Kontext und passende Governance-Regeln betreten.",
					},
					{
						title: "Quellen, Inhalte und Urteile ergänzen",
						body: "Lokalisierungen, Beziehungen, Tags und Abstimmungen beitragen.",
					},
					{
						title: "Die nächste Entdeckung genauer machen",
						body: "Gemeinsames Wissen fließt in Suche, Kuration und Empfehlungen zurück.",
					},
				],
				closing:
					"Nicht eine einzelne Fähigkeit bildet den Burggraben, sondern jede Entdeckung kann neuen Kontext schaffen und jede Mitwirkung verbessert die nächste Entdeckung.",
				capabilitiesAction: "Vollständige Fähigkeitskarte ansehen",
				usesAction: "Praktische Anwendungsfälle entdecken",
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
				title: "Es in jeder vertrauten Sprache finden",
				body: "Originaltitel, Romanisierung, offizielle Übersetzungen und gebräuchliche Namen der Community werden gemeinsam zu Sucheinstiegen und bewahren ihren jeweiligen Sprachkontext.",
				result: "Sprachen überqueren, ohne dasselbe Werk neu kennenlernen zu müssen.",
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
				body: `Entwickelnde können derzeit über ${API} und klar abgegrenzte Tokens zugreifen; ${OAUTH}- und ${MCP}-Integrationen werden entsprechend den in der Fähigkeitskarte ausgewiesenen Phasen schrittweise geöffnet.`,
				result: "Es ist offen sichtbar, was heute nutzbar ist und wohin der nächste Schritt führt.",
			},
		],
		closing: {
			title: "Möchtest du Gegenwart, laufenden Aufbau und langfristige Richtung unterscheiden?",
			body: "Die Fähigkeitskarte kennzeichnet die Phase jeder Fähigkeit und erklärt mit vollständiger Dokumentation ihre Beziehung zum Werknetz.",
			action: "Fähigkeitskarte durchsuchen",
		},
	},
	products: {
		eyebrow: "Fähigkeitskarte",
		title: "Ausgehend von Webromanen das gesamte Werknetz sehen.",
		lead: "Hier werden verfügbare Fähigkeiten, Systeme im Aufbau und veröffentlichte Entwurfsrichtungen zugleich festgehalten. Statuskennzeichnungen erklären die Gegenwart; vollständige Dokumentation erklärt, wie sie zusammenarbeiten werden.",
		searchLabel: "Fähigkeiten suchen",
		searchPlaceholder: "Nach Name, Zweck oder Status suchen",
		allLayers: "Alle",
		empty: "Keine passenden Fähigkeiten.",
		openProduct: "Fähigkeit ansehen",
		stage: {
			legend: "Fähigkeitsstatus",
			current: "Aktueller Status",
			labels: { available: "Verfügbar", development: "In Entwicklung", planned: "Geplant" },
		},
		layers: {
			identity: {
				title: "Werkidentität",
				body: `Dasselbe Werk erkennen und Quellen, Ausgaben, Serien, ${deTerminology.entity.forms.label} und Klassifikation verbinden.`,
			},
			form: {
				title: "Lesen und Inhalt",
				body: `Webromane, ${deTerminology.post.forms.pluralLabel}, Medien, Rezensionen und Antworten tragen.`,
			},
			structure: {
				title: "Struktur und Geschichte",
				body: "Inhalte zusammensetzen und Blockidentität, veröffentlichte Revisionen sowie Entwicklungskontext bewahren.",
			},
			community: {
				title: "Community und Entdeckung",
				body: `Sammeln, ${deTerminology.follow.forms.action}, Fortschritt bewahren, einem ${REALM} beitreten und Entdeckung im Kreislauf halten.`,
			},
			open: {
				title: "Offene Schnittstellen",
				body: `Werkzeuge, Dienste, ${AI} und neue Werk-Einstiege mit klaren Berechtigungen verbinden.`,
			},
		},
	},
	product: {
		breadcrumbHome: "Startseite",
		breadcrumbProducts: "Fähigkeitskarte",
		layerLabel: "Zugehörige Ebene",
		related: "Verwandte Fähigkeiten",
		readNext: "Entlang der Beziehungen weiter verstehen",
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
