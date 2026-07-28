import { insert } from "native-i18n";

import { esTerminology } from "@rezics/i18n/terminology/es";

const { forms: postTerms } = esTerminology.post;

export default {
	memberSince: insert("Se unió el {{date}}", { date: String }),
	editProfile: "Editar perfil",
	tabsLabel: "Páginas del perfil",
	tabs: {
		profile: "Perfil",
		content: "Contenido",
	},
	aboutTitle: "Acerca de",
	aboutEmpty: "Esta persona aún no ha añadido una presentación detallada.",
	contentTitle: "Contenido publicado",
	contentDescription: `Las ${postTerms.plural} públicas y reseñas atribuidas a esta persona, además de sus colecciones y entradas de catálogo.`,
	contentEmptyTitle: "Todavía no hay contenido público",
	contentEmptyDescription:
		"El contenido público que publique o posea esta persona aparecerá aquí.",
} satisfies typeof import("../zh-Hant/profiles").default;
