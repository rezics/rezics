import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}, ${verbatimTerms.png.value}, ${verbatimTerms.webp.value} oder ${verbatimTerms.avif.value}`;

export default {
	title: "Cover",
	choose: "Bild auswählen, hierher ziehen oder einfügen",
	hint: `${SupportedImageFormats}, bis zu 10 ${verbatimTerms.mib.value}`,
	upload: "Cover hochladen",
	replace: "Ersetzen",
	remove: "Entfernen",
	cancel: "Abbrechen",
	inherit: "Das erste verfügbare Cover in der Lokalisierungsreihenfolge verwenden",
	invalid: `Wähle ein Bild im Format ${SupportedImageFormats} mit weniger als 10 ${verbatimTerms.mib.value}.`,
	failed: "Das Cover konnte nicht hochgeladen werden. Versuche es erneut.",
} satisfies typeof import("../zh-Hant/cover").default;
