import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: realmTerms } = enTerminology.realm;

export default {
	eyebrow: "Curate together, discuss with care",
	title: "A place where units, relationships, and knowledge grow together.",
	description: `Explore books, software, and media, track your progress, and improve entries with the ${realmTerms.inline}.`,
	latest: "Recently added",
} satisfies typeof import("../zh-Hant/home").default;
