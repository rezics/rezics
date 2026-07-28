import { insert } from "native-i18n";

import { deTerminology } from "@rezics/i18n/terminology/de";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: realmTerms } = deTerminology.realm;

export default {
	title: "Verwaltungskonsole",
	description:
		"Plattformberechtigungen schalten die einzelnen Verwaltungsbereiche frei; sie stellen weder eine Benutzeridentität noch ein Beschäftigungsverhältnis dar.",
	backToApplication: "Zurück zur Anwendung",
	navigation: "Navigation der Verwaltungskonsole",
	overview: "Alle Verwaltungsbereiche",
	cancel: "Abbrechen",
	sections: {
		access: {
			label: "Plattformzugriff",
			description:
				"Prüfe oder verwalte Plattformberechtigungen für Profile einschließlich Ablauf und Herkunft jeder Vergabe.",
		},
		audit: {
			label: "Sicherheitsprotokoll",
			description: `Prüfe wichtige administrative Ereignisse und Sicherheitsentscheidungen für die Plattform, ${realmTerms.pluralLabel} und Units.`,
		},
	},
	access: {
		searchTitle: "Profil suchen",
		searchLabel: "Name oder Anmelde-E-Mail-Adresse",
		searchPlaceholder: "Name oder E-Mail-Adresse eingeben",
		search: "Suchen",
		searchResults: "Suchergebnisse",
		activeProfiles: "Profile mit aktivem Plattformzugriff",
		noProfiles: "Es gibt keine aktiven Plattformberechtigungen.",
		noSearchResults: "Keine passenden Profile gefunden.",
		selectProfile: "Wähle ein Profil aus, um dessen Plattformzugriff zu prüfen.",
		capabilityCount: insert("{{count}} Berechtigungen", { count: Number }),
		capability: "Berechtigung",
		expiry: "Ablauf",
		expiryFor: insert("Ablauf für {{capability}}", { capability: String }),
		noExpiry: "Läuft nicht ab",
		provenance: "Herkunft der Vergabe",
		grantProvenance: insert("Von {{profileId}} am {{date}} vergeben", {
			profileId: String,
			date: String,
		}),
		notGranted: "Nicht direkt vergeben",
		readOnly: "Du kannst den Plattformzugriff prüfen, aber nicht ändern.",
		grantAll: "Alle Berechtigungen vergeben",
		clearAll: "Alle Berechtigungen entfernen",
		save: "Plattformzugriff speichern",
		revokeAllTitle: "Diesem Profil den gesamten Plattformzugriff entziehen?",
		revokeAllDescription:
			"Dadurch werden alle aktiven Vergaben entzogen. Der Server lehnt die Änderung ab, wenn damit die letzte nicht ablaufende Verwaltung des Plattformzugriffs entfernt würde.",
		confirmRevokeAll: "Vollständigen Entzug bestätigen",
	},
	audit: {
		category: "Ereigniskategorie",
		allCategories: "Alle Kategorien",
		categories: {
			admin_activity: "Administrative Aktivität",
			policy_denied: "Durch Richtlinie abgelehnt",
			system_event: "Systemereignis",
		},
		outcome: "Ergebnis",
		allOutcomes: "Alle Ergebnisse",
		outcomes: {
			succeeded: "Erfolgreich",
			denied: "Abgelehnt",
			failed: "Fehlgeschlagen",
		},
		time: "Zeitpunkt",
		action: "Aktion",
		actor: "Ausführende Stelle",
		authority: "Zuständigkeitsbereich",
		authorities: {
			platform: "Plattform",
			realm: realmTerms.label,
			unit: "Unit",
		},
		empty: "Keine Protokollereignisse entsprechen den aktuellen Filtern.",
		previousPage: "Vorherige Seite",
		nextPage: "Nächste Seite",
		selectEvent: "Wähle ein Ereignis aus, um den vollständigen Protokolleintrag zu prüfen.",
		detailsTitle: "Ereignisdetails",
		systemActor: "System",
		credential: "Art der Anmeldeinformation",
		credentialId: `Anmeldeinformations-${verbatimTerms.id.value}`,
		credentials: {
			session: "Interaktive Sitzung",
			api_token: `${verbatimTerms.api.value}-Token`,
			bootstrap: "Systeminitialisierung",
			system: "Systemprozess",
		},
		scopedAuthority: insert("{{kind}} ({{id}})", { kind: String, id: String }),
		target: "Ziel",
		noTarget: "Kein bestimmtes Ziel",
		reasonCode: "Ursachencode",
		requestId: `Anfrage-${verbatimTerms.id.value}`,
		traceId: `Trace-${verbatimTerms.id.value}`,
		rawDetails: "Strukturierte Details",
	},
} satisfies typeof import("../zh-Hant/console").default;
