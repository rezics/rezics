import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}, ${verbatimTerms.png.value}, ${verbatimTerms.webp.value} ou ${verbatimTerms.avif.value}`;

export default {
	title: "Couverture",
	choose: "Choisir, déposer ou coller une image",
	hint: `${SupportedImageFormats}, jusqu’à 10 ${verbatimTerms.mib.value}`,
	upload: "Importer la couverture",
	replace: "Remplacer",
	remove: "Supprimer",
	cancel: "Annuler",
	inherit: "Utiliser la première couverture disponible dans l’ordre des langues",
	invalid: `Choisissez une image ${SupportedImageFormats} de moins de 10 ${verbatimTerms.mib.value}.`,
	failed: "La couverture n’a pas pu être importée. Réessayez.",
} satisfies typeof import("../zh-Hant/cover").default;
