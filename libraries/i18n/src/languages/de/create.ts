import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { deTerminology } from "@rezics/i18n/terminology/de";

const { forms: postTerms } = deTerminology.post;
const { forms: realmTerms } = deTerminology.realm;
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
			label: "Katalogeinträge",
			description: "Zeige Katalogeinträge zu deiner Arbeit an und verwalte sie.",
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
