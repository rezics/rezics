import { insert } from "native-i18n";

import { frTerminology } from "@rezics/i18n/terminology/fr";

const { forms: postTerms } = frTerminology.post;
const { forms: realmTerms } = frTerminology.realm;

export default {
	memberSince: insert("Membre depuis le {{date}}", { date: String }),
	editProfile: "Modifier le profil",
	tabsLabel: "Pages du profil",
	tabs: {
		profile: "Profil",
		activity: "Activité",
		content: "Contenu",
	},
	aboutTitle: "À propos",
	aboutEmpty: "Cette personne n’a pas encore ajouté de présentation détaillée.",
	activityTitle: "Notes et progression",
	activityDescription:
		"Les notes et la progression actuelle visibles apparaissent ici selon la confidentialité de chaque élément et le réglage global.",
	activityEmpty: "Aucune note ni progression visible pour le moment.",
	activityScores: "Notes",
	activityProgress: "Progression",
	activityScoreRealm: insert(`${realmTerms.label} : {{realm}}`, { realm: String }),
	activityScoreValue: insert("{{value}} / 10", { value: Number }),
	activityProgressValue: insert("{{percentage}} %", { percentage: Number }),
	progressStatuses: {
		backlog: "À commencer",
		active: "En cours",
		paused: "En pause",
		completed: "Terminé",
		dropped: "Abandonné",
	},
	contentTitle: "Contenu publié",
	contentDescription: `Les ${postTerms.plural} publiques et les avis attribués à cette personne, ainsi que les collections et entrées de catalogue dont elle est propriétaire.`,
	contentEmptyTitle: "Aucun contenu public pour le moment",
	contentEmptyDescription:
		"Le contenu public publié ou possédé par cette personne apparaîtra ici.",
} satisfies typeof import("../zh-Hant/profiles").default;
