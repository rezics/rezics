import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { deTerminology } from "@rezics/i18n/terminology/de";

const { forms: followTerms } = deTerminology.follow;
const { forms: realmTerms } = deTerminology.realm;

export default {
	center: {
		title: "Benachrichtigungen",
		description:
			"Prüfe aktuelle Aktivitäten und Systemmeldungen, die deine Aufmerksamkeit erfordern.",
		headerLabel: "Benachrichtigungen",
		headerUnreadLabel: insert("Benachrichtigungen, {{count}} ungelesen", { count: Number }),
		receivedInvitations: "Erhaltene Zugriffseinladungen",
		invitationsDescription:
			"Prüfe und beantworte Einladungen anderer Personen zum Zugriff auf eine Unit.",
		backToNotifications: "Zurück zu den Benachrichtigungen",
		markAllRead: "Alle als gelesen markieren",
		markRead: "Als gelesen markieren",
		loadMore: "Weitere Benachrichtigungen laden",
		unread: "Ungelesen",
		emptyTitle: "Noch keine Benachrichtigungen",
		emptyDescription: "Neue Aktivitäten und Systemmeldungen erscheinen hier.",
	},
	reply: {
		title: `Neue Antwort auf ${verbatimTerms.rezics.value}`,
		body: "Jemand hat auf eine Unterhaltung geantwortet, an der du teilnimmst.",
	},
	new_follower: {
		title: `Neuer ${followTerms.follower} auf ${verbatimTerms.rezics.value}`,
		body: `Jemand hat begonnen, dir zu ${followTerms.action}.`,
	},
	direct_message: {
		title: `Neue Nachricht auf ${verbatimTerms.rezics.value}`,
		body: "Du hast eine neue Direktnachricht erhalten.",
	},
	moderation: {
		title: `Moderationsmeldung von ${verbatimTerms.rezics.value}`,
		body: "Der Moderationsstatus deines Inhalts hat sich geändert.",
	},
	report_resolution: {
		title: `Entscheidung zu einer Meldung von ${verbatimTerms.rezics.value}`,
		body: "Zu einer von dir eingereichten Meldung liegt eine Entscheidung vor.",
	},
	realm: {
		title: `${realmTerms.label}-Meldung von ${verbatimTerms.rezics.value}`,
		body: `In einem ${realmTerms.inline}, dem du angehörst, hat sich etwas geändert.`,
	},
	system: {
		title: `Systembenachrichtigung von ${verbatimTerms.rezics.value}`,
		body: "Du hast eine Systembenachrichtigung erhalten.",
	},
	unit_access_invitation: {
		title: "Neue Zugriffseinladung",
		body: "Jemand hat dich zum Zugriff auf eine Unit eingeladen. Prüfe die Einladung, bevor du antwortest.",
	},
} satisfies typeof import("../zh-Hant/notifications").default;
