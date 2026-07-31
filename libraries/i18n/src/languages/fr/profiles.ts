import { insert } from "native-i18n";

import { frTerminology } from "@rezics/i18n/terminology/fr";

const { forms: realmTerms } = frTerminology.realm;
const { forms: zoneTerms } = frTerminology.zone;
const { forms: entityTerms } = frTerminology.entity;

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
	contentTitle: "Contenu public",
	contentDescription: `Contenu public attribué directement à cette personne ou à une ${entityTerms.inline} qui la crédite comme éditrice, ainsi que les ${realmTerms.pluralLabel} et ${zoneTerms.pluralLabel} dont elle est propriétaire.`,
	contentEmptyTitle: "Aucun contenu public pour le moment",
	contentEmptyDescription: `Le contenu public attribué et les ${realmTerms.pluralLabel} ou ${zoneTerms.pluralLabel} dont elle est propriétaire apparaîtront ici.`,
} satisfies typeof import("../zh-Hant/profiles").default;
