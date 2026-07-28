import { frTerminology } from "@rezics/i18n/terminology/fr";

const { forms: realmTerms } = frTerminology.realm;

export default {
	eyebrow: "Organiser ensemble, échanger avec attention",
	title: "Un lieu où les Units, les relations et les connaissances se développent ensemble.",
	description: `Explorez des livres, des logiciels et des médias, suivez votre progression et améliorez les entrées avec le ${realmTerms.inline}.`,
	latest: "Ajouts récents",
} satisfies typeof import("../zh-Hant/home").default;
