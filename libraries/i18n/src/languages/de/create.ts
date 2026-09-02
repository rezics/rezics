import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { deTerminology } from "@rezics/i18n/terminology/de";

const { forms: postTerms } = deTerminology.post;
const { forms: realmTerms } = deTerminology.realm;
const { forms: entityTerms } = deTerminology.entity;
const { forms: zoneTerms } = deTerminology.zone;

export default {
	workspace: {
		title: verbatimTerms.studio.value,
		description:
			"Zeige Inhalte, die du derzeit bearbeiten kannst, oder öffentliche Inhalte, an denen du mitgewirkt hast.",
		backToApplication: `Zurück zu ${verbatimTerms.rezics.value}`,
		navigation: `${verbatimTerms.studio.value}-Navigation`,
		overview: "Inhaltstypen",
		backToOverview: "Zurück zu den Inhaltstypen",
	},
	mode: {
		label: "Inhaltsliste",
		options: {
			workspace: "Dein Arbeitsbereich",
			contributions: "Deine Mitwirkungen",
		},
	},
	entityHelp: {
		label: "Hinweise zu Mitwirkungsangaben öffnen",
		title: "Hinweise zu Mitwirkungsangaben",
		description: `Mitwirkungsangaben müssen mit einer ${entityTerms.inline} verknüpft sein. Wenn du keine ${entityTerms.inline} findest oder zum Beispiel eine eigene Autorenidentität anlegen möchtest, lege bitte zuerst eine ${entityTerms.inline} an.`,
		createEntity: `${entityTerms.label} erstellen`,
		close: "Schließen",
	},
	sections: {
		book: {
			label: "Bücher",
			description: "Zeige Bücher zu deiner Arbeit an und verwalte sie.",
		},
		software: {
			label: "Software",
			description: "Zeige Softwareeinträge zu deiner Arbeit an und verwalte sie.",
		},
		media: {
			label: "Medien",
			description: "Zeige Medien zu deiner Arbeit an und verwalte sie.",
		},
		entity: {
			label: entityTerms.pluralLabel,
			description: `Zeige ${entityTerms.plural} zu deiner Arbeit an und verwalte sie.`,
		},
		tag: { label: "Tags", description: "Zeige Tags zu deiner Arbeit an und verwalte sie." },
		realm: {
			label: realmTerms.label,
			description: `Zeige ${realmTerms.pluralLabel} zu deiner Arbeit an und verwalte sie.`,
		},
		zone: {
			label: zoneTerms.label,
			description: `Zeige ${zoneTerms.pluralLabel} zu deiner Arbeit an und verwalte sie.`,
		},
		post: {
			label: postTerms.label,
			description: `Zeige ${postTerms.pluralLabel} zu deiner Arbeit an und verwalte sie.`,
		},
		wiki: {
			label: "Wiki-Artikel",
			description: "Zeige von dir betreute Wiki-Artikel an und verwalte sie.",
		},
		collection: {
			label: "Sammlungen",
			description: "Zeige Sammlungen zu deiner Arbeit an und verwalte sie.",
		},
		review: {
			label: "Rezensionen",
			description: "Zeige Rezensionen zu deiner Arbeit an und verwalte sie.",
		},
		poll: {
			label: "Umfragen",
			description: "Zeige Umfragen zu deiner Arbeit an und verwalte sie.",
		},
	},
	realmTagContext: {
		label: `${realmTerms.label}-Tag-Erklärung`,
		description: `Erstelle die Wiki-Erklärung dieses ${realmTerms.inline}s zu einem Tag.`,
	},
	communityUnitSearch: {
		policyTitle: "Vor dem Erstellen suchen",
		policy:
			"Um ein gutes Miteinander zu wahren, suche vor dem Erstellen eines öffentlichen Eintrags und vergewissere dich, dass der gewünschte Inhalt noch nicht existiert. Der Missbrauch dieser Funktion kann Sanktionen nach sich ziehen.",
		confirmationLabel: insert(
			"Ich habe die vorhandenen {{subject}} geprüft und bestätigt, dass dieser Eintrag noch nicht existiert.",
			{ subject: String },
		),
		prompt: insert("Vorhandene {{subject}} durchsuchen", { subject: String }),
		pageTitle: insert("Vorhandene {{subject}} durchsuchen", { subject: String }),
		pageDescription: insert("Prüfe, ob die gewünschten {{subject}} bereits existieren.", {
			subject: String,
		}),
		backToSection: insert("Zurück zu {{subject}}", { subject: String }),
		searchLabel: insert("{{subject}} durchsuchen", { subject: String }),
		searchPlaceholder: insert("Namen der {{subject}} eingeben", { subject: String }),
		searchAction: "Suchen",
		searchHint: "Gib einen Namen ein, um nach möglicherweise vorhandenen Einträgen zu suchen.",
		searchFailed:
			"Die Suche ist vorübergehend nicht verfügbar. Versuche es erneut oder kehre zum Erstellungsformular zurück.",
		resultsTitle: "Möglicherweise vorhandene Einträge",
		noResultsTitle: insert("Keine passenden {{subject}} gefunden", { subject: String }),
		noResultsDescription:
			"Wenn die Suchbegriffe korrekt sind, kannst du mit der Erstellung fortfahren.",
		realmTagContextOnly: `Hier erscheinen nur Tags, die in diesem ${realmTerms.inline} offiziell erklärt werden. Fehlt ein Tag, muss die Verwaltung des ${realmTerms.inline} zuerst eine Tag-Erklärung anlegen.`,
		notListedTitle: "Keines dieser Ergebnisse passt?",
		notListedDescription:
			"Prüfe zuerst ähnliche Einträge. Fahre nur fort, wenn keiner davon der gesuchte Inhalt ist.",
		createAction: "Mit dem Erstellen fortfahren",
		subjects: {
			book: "Bücher",
			software: "Softwareeinträge",
			media: "Medieneinträge",
			person: "Personen",
			organization: "Organisationen",
			character: "Figuren",
			tag: "Tags",
		},
	},
	list: {
		create: "Erstellen",
		empty: {
			workspace: "Keine bearbeitbaren Inhalte entsprechen den aktuellen Filtern.",
			contributions: "Keine öffentlichen Mitwirkungen entsprechen den aktuellen Filtern.",
		},
		untitled: "Inhalt ohne Titel",
		immutable: "Unveränderlich",
		contributionCount: insert("Mitwirkungen: {{count}}", { count: Number }),
		activity: {
			visited: "Besucht",
			assigned: "Zugewiesen",
			created: "Erstellt",
			participated: "Bearbeitet",
		},
	},
	filters: {
		sourceLabel: "Quelle des Arbeitsbereichs",
		kindLabel: "Beitragstyp",
		statusLabel: "Inhaltsstatus",
		visibilityLabel: "Sichtbarkeit",
		any: "Alle",
		more: "Weitere Filter",
		clear: "Filter zurücksetzen",
		cancel: "Abbrechen",
		apply: "Filter anwenden",
		sources: {
			all: "Alle bearbeitbaren Inhalte",
			owned: "Meine Inhalte",
			direct: "Direkt zugewiesen",
			delegated: "Über Team delegiert",
		},
		kinds: {
			all: "Alle Mitwirkungen",
			created: "Von mir erstellt",
			contributed: "Von mir bearbeitet",
		},
		statuses: { draft: "Entwurf", published: "Veröffentlicht", archived: "Archiviert" },
		visibilities: { public: "Öffentlich", unlisted: "Nicht gelistet", private: "Privat" },
	},
	relations: {
		owner: "Eigentümer",
		direct: "Direkt zugewiesen",
		realm: "Über Team delegiert",
		created: "Ersteller",
		contributed: "Mitwirkender",
	},
	developmentBadge: "In Entwicklung",
} satisfies typeof import("../zh-Hant/create").default;
