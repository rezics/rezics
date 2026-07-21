import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}, ${verbatimTerms.png.value}, ${verbatimTerms.webp.value}, or ${verbatimTerms.avif.value}`;

export default {
	title: "Cover",
	choose: "Choose, drop, or paste an image",
	hint: `${SupportedImageFormats}, up to 10 ${verbatimTerms.mib.value}`,
	upload: "Upload cover",
	replace: "Replace",
	remove: "Remove",
	cancel: "Cancel",
	inherit: "Use the first available cover in localization order",
	invalid: `Choose a ${SupportedImageFormats} image under 10 ${verbatimTerms.mib.value}.`,
	failed: "The cover could not be uploaded. Try again.",
} satisfies typeof import("../zh-Hant/cover").default;
