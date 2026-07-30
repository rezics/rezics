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
			"Zeige Inhalte an, die du erstellt, betreut oder zur Verwaltung erhalten hast.",
		backToApplication: `Zurück zu ${verbatimTerms.rezics.value}`,
		navigation: `${verbatimTerms.studio.value}-Navigation`,
		overview: "Inhaltstypen",
		backToOverview: "Zurück zu den Inhaltstypen",
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
		policy: "Um ein gutes Miteinander zu wahren, suche vor dem Erstellen eines öffentlichen Eintrags und vergewissere dich, dass der gewünschte Inhalt noch nicht existiert. Der Missbrauch dieser Funktion kann Sanktionen nach sich ziehen.",
		requiredTitle: "Zuerst vorhandene Einträge prüfen",
		requiredDescription:
			"Führe eine Suche durch, bevor du diesen öffentlichen Eintrag absendest.",
		prompt: insert("Vorhandene {{subject}} durchsuchen", { subject: String }),
		confirmedTitle: insert("Vorhandene {{subject}} wurden durchsucht", { subject: String }),
		confirmedDescription:
			"Dieser Titel wurde gesucht. Nach einer Änderung von Titel oder Art ist eine neue Suche erforderlich.",
		pageTitle: insert("Vorhandene {{subject}} durchsuchen", { subject: String }),
		pageDescription: insert("Prüfe, ob die gewünschten {{subject}} bereits existieren.", {
			subject: String,
		}),
		backToSection: insert("Zurück zu {{subject}}", { subject: String }),
		searchLabel: insert("{{subject}} durchsuchen", { subject: String }),
		searchPlaceholder: insert("Namen der {{subject}} eingeben", { subject: String }),
		searchAction: "Suchen",
		searchHint:
			"Gib einen Namen ein und führe die Suche aus, um die Erstellungsoption freizuschalten.",
		searchFailed:
			"Die Suche ist vorübergehend nicht verfügbar. Versuche es erneut, bevor du einen öffentlichen Eintrag erstellst.",
		resultsTitle: "Möglicherweise vorhandene Einträge",
		noResultsTitle: insert("Keine passenden {{subject}} gefunden", { subject: String }),
		noResultsDescription:
			"Wenn die Suchbegriffe korrekt sind, kannst du mit der Erstellung fortfahren.",
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
		empty: "Keine Inhalte entsprechen den aktuellen Filtern.",
		untitled: "Inhalt ohne Titel",
		contributionCount: insert("Mitwirkungen: {{count}}", { count: Number }),
		activity: {
			visited: "Besucht",
			updated: "Aktualisiert",
			created: "Erstellt",
			relevant: "Relevant",
		},
	},
	filters: {
		viewLabel: "Arbeitsbeziehung",
		permissionLabel: "Aktuelle Berechtigung",
		workStateLabel: "Arbeitsstatus",
		statusLabel: "Inhaltsstatus",
		visibilityLabel: "Sichtbarkeit",
		sortLabel: "Sortierung",
		any: "Alle",
		more: "Weitere Filter",
		clear: "Filter zurücksetzen",
		cancel: "Abbrechen",
		apply: "Filter anwenden",
		views: {
			all: "Meine Arbeit",
			created: "Von mir erstellt",
			contributed: "Mit meiner Beteiligung",
			assigned: "Direkt zugewiesen",
			delegated: "Vom Team delegiert",
		},
		permissions: {
			"unit.update": "Darf bearbeiten",
			"unit.status.update": "Darf den Status ändern",
			"unit.access.manage": "Darf den Zugriff verwalten",
			"unit.realm-publication.manage": `Darf Veröffentlichungen in ${realmTerms.label} verwalten`,
		},
		workStates: { actionable: "Bearbeitbar", blocked: "Derzeit blockiert" },
		statuses: { draft: "Entwurf", published: "Veröffentlicht", archived: "Archiviert" },
		visibilities: { public: "Öffentlich", unlisted: "Nicht gelistet", private: "Privat" },
		sorts: {
			recent: "Zuletzt besucht",
			updated: "Zuletzt aktualisiert",
			created: "Zuletzt erstellt",
			relevant: "Zuletzt relevant",
		},
	},
	relations: {
		created: "Ersteller",
		contributed: "Mitwirkender",
		assigned: "Direkt zugewiesen",
		delegated: "Vom Team delegiert",
		blocked: "Derzeit blockiert",
	},
	developmentBadge: "In Entwicklung",
} satisfies typeof import("../zh-Hant/create").default;
