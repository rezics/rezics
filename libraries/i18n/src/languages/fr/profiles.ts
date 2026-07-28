import { insert } from "native-i18n";

import { frTerminology } from "@rezics/i18n/terminology/fr";

const { forms: postTerms } = frTerminology.post;

export default {
	memberSince: insert("Membre depuis le {{date}}", { date: String }),
	editProfile: "Modifier le profil",
	tabsLabel: "Pages du profil",
	tabs: {
		profile: "Profil",
		content: "Contenu",
	},
	aboutTitle: "À propos",
	aboutEmpty: "Cette personne n’a pas encore ajouté de présentation détaillée.",
	contentTitle: "Contenu publié",
	contentDescription: `Les ${postTerms.plural} publiques et les avis attribués à cette personne, ainsi que les collections et entrées de catalogue dont elle est propriétaire.`,
	contentEmptyTitle: "Aucun contenu public pour le moment",
	contentEmptyDescription:
		"Le contenu public publié ou possédé par cette personne apparaîtra ici.",
} satisfies typeof import("../zh-Hant/profiles").default;
