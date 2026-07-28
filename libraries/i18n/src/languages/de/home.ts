import { deTerminology } from "@rezics/i18n/terminology/de";

const { forms: realmTerms } = deTerminology.realm;

export default {
	eyebrow: "Gemeinsam kuratieren, achtsam diskutieren",
	title: "Ein Ort, an dem Units, Beziehungen und Wissen gemeinsam wachsen.",
	description: `Entdecke Bücher, Software und Medien, verfolge deinen Fortschritt und verbessere Einträge gemeinsam im ${realmTerms.inline}.`,
	latest: "Kürzlich hinzugefügt",
} satisfies typeof import("../zh-Hant/home").default;
