import { insert } from "native-i18n";

import { deTerminology } from "@rezics/i18n/terminology/de";

const { forms: postTerms } = deTerminology.post;
const { forms: realmTerms } = deTerminology.realm;
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
	contentTitle: "Veröffentlichte Inhalte",
	contentDescription: `Öffentliche ${postTerms.pluralLabel} und Rezensionen, die dieser Person zugeordnet sind, sowie eigene Sammlungen und ${entityTerms.plural}.`,
	contentEmptyTitle: "Noch keine öffentlichen Inhalte",
	contentEmptyDescription:
		"Von dieser Person veröffentlichte oder verwaltete öffentliche Inhalte erscheinen hier.",
} satisfies typeof import("../zh-Hant/profiles").default;
