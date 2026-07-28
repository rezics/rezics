import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}, ${verbatimTerms.png.value}, ${verbatimTerms.webp.value} o ${verbatimTerms.avif.value}`;

export default {
	title: "Portada",
	choose: "Elige, arrastra o pega una imagen",
	hint: `${SupportedImageFormats}, hasta 10 ${verbatimTerms.mib.value}`,
	upload: "Subir portada",
	replace: "Reemplazar",
	remove: "Eliminar",
	cancel: "Cancelar",
	inherit: "Usar la primera portada disponible según el orden de idiomas",
	invalid: `Elige una imagen ${SupportedImageFormats} de menos de 10 ${verbatimTerms.mib.value}.`,
	failed: "No se pudo subir la portada. Vuelve a intentarlo.",
} satisfies typeof import("../zh-Hant/cover").default;
