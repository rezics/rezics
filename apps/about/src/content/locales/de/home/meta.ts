import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	title: `${verbatimTerms.rezics.value} — Identität, Struktur und Verlauf für Inhalte`,
	description: `Produkte und Plattformfähigkeiten von ${verbatimTerms.rezics.value}.`,
} satisfies typeof import("../../en/home/meta").default;

export default content;
