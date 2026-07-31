import { insert } from "native-i18n";

import { deTerminology } from "@rezics/i18n/terminology/de";

const { forms: realmTerms } = deTerminology.realm;
const { forms: zoneTerms } = deTerminology.zone;
const { forms: entityTerms } = deTerminology.entity;

export default {
	memberSince: insert("Beigetreten am {{date}}", { date: String }),
	editProfile: "Profil bearbeiten",
	tabsLabel: "Profilseiten",
	tabs: {
		profile: "Profil",
		activity: "Aktivität",
		content: "Inhalte",
	},
	aboutTitle: "Über mich",
	aboutEmpty: "Diese Person hat noch keine ausführliche Vorstellung hinzugefügt.",
	activityTitle: "Bewertungen und Fortschritt",
	activityDescription:
		"Hier erscheinen sichtbare Bewertungen und der aktuelle Fortschritt entsprechend den Datenschutzregeln des Eintrags und der allgemeinen Einstellung.",
	activityEmpty: "Noch keine sichtbaren Bewertungen oder Fortschritte.",
	activityScores: "Bewertungen",
	activityProgress: "Fortschritt",
	activityScoreRealm: insert(`${realmTerms.label}: {{realm}}`, { realm: String }),
	activityScoreValue: insert("{{value}} / 10", { value: Number }),
	activityProgressValue: insert("{{percentage}} %", { percentage: Number }),
	progressStatuses: {
		backlog: "Nicht begonnen",
		active: "In Bearbeitung",
		paused: "Pausiert",
		completed: "Abgeschlossen",
		dropped: "Abgebrochen",
	},
	contentTitle: "Öffentliche Inhalte",
	contentDescription: `Öffentliche Inhalte, die dieser Person direkt oder über eine ${entityTerms.inline} zugeordnet sind, die sie als Herausgeberin nennt, sowie eigene ${realmTerms.pluralLabel} und ${zoneTerms.pluralLabel}.`,
	contentEmptyTitle: "Noch keine öffentlichen Inhalte",
	contentEmptyDescription: `Öffentlich zugeordnete Inhalte und eigene ${realmTerms.pluralLabel} oder ${zoneTerms.pluralLabel} erscheinen hier.`,
} satisfies typeof import("../zh-Hant/profiles").default;
