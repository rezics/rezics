import { insert } from "native-i18n";

import { deTerminology } from "@rezics/i18n/terminology/de";

const { forms: postTerms } = deTerminology.post;

export default {
	memberSince: insert("Beigetreten am {{date}}", { date: String }),
	editProfile: "Profil bearbeiten",
	tabsLabel: "Profilseiten",
	tabs: {
		profile: "Profil",
		content: "Inhalte",
	},
	aboutTitle: "Über mich",
	aboutEmpty: "Diese Person hat noch keine ausführliche Vorstellung hinzugefügt.",
	contentTitle: "Veröffentlichte Inhalte",
	contentDescription: `Öffentliche ${postTerms.pluralLabel} und Rezensionen, die dieser Person zugeordnet sind, sowie eigene Sammlungen und Katalogeinträge.`,
	contentEmptyTitle: "Noch keine öffentlichen Inhalte",
	contentEmptyDescription:
		"Von dieser Person veröffentlichte oder verwaltete öffentliche Inhalte erscheinen hier.",
} satisfies typeof import("../zh-Hant/profiles").default;
