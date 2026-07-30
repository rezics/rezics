import { insert } from "native-i18n";

import { esTerminology } from "@rezics/i18n/terminology/es";

const { forms: postTerms } = esTerminology.post;
const { forms: realmTerms } = esTerminology.realm;
const { forms: entityTerms } = esTerminology.entity;

export default {
	memberSince: insert("Se unió el {{date}}", { date: String }),
	editProfile: "Editar perfil",
	tabsLabel: "Páginas del perfil",
	tabs: {
		profile: "Perfil",
		activity: "Actividad",
		content: "Contenido",
	},
	aboutTitle: "Acerca de",
	aboutEmpty: "Esta persona aún no ha añadido una presentación detallada.",
	activityTitle: "Puntuaciones y progreso",
	activityDescription:
		"Aquí aparecen las puntuaciones y el progreso actual visibles según la privacidad de cada elemento y la configuración general.",
	activityEmpty: "Todavía no hay puntuaciones ni registros de progreso visibles.",
	activityScores: "Puntuaciones",
	activityProgress: "Progreso",
	activityScoreRealm: insert(`${realmTerms.label}: {{realm}}`, { realm: String }),
	activityScoreValue: insert("{{value}} / 10", { value: Number }),
	activityProgressValue: insert("{{percentage}} %", { percentage: Number }),
	progressStatuses: {
		backlog: "Sin empezar",
		active: "En curso",
		paused: "En pausa",
		completed: "Completado",
		dropped: "Abandonado",
	},
	contentTitle: "Contenido publicado",
	contentDescription: `Las ${postTerms.plural} públicas y reseñas atribuidas a esta persona, además de sus colecciones y ${entityTerms.plural}.`,
	contentEmptyTitle: "Todavía no hay contenido público",
	contentEmptyDescription:
		"El contenido público que publique o posea esta persona aparecerá aquí.",
} satisfies typeof import("../zh-Hant/profiles").default;
