import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}, ${verbatimTerms.png.value}, ${verbatimTerms.webp.value}, or ${verbatimTerms.avif.value}`;

export default {
	choose: "Choose, drop, or paste an image",
	hint: `${SupportedImageFormats}, up to 10 ${verbatimTerms.mib.value}`,
	replace: "Replace",
	remove: "Remove",
	cancel: "Cancel",
	invalid: `Choose a ${SupportedImageFormats} image under 10 ${verbatimTerms.mib.value}.`,
	current: "Current language override",
	displayPreview: "Displayed area",
	bannerPreview: {
		description:
			"The original is preserved. Areas outside this frame are not shown. A 4:1 image is recommended.",
		showOriginal: "View full image",
		hideOriginal: "Hide full image",
		original: "Full image",
	},
	roles: {
		avatar: {
			title: "Avatar",
			upload: "Upload avatar",
			inherit: "Use the first available avatar in localization order",
			failed: "The avatar could not be uploaded. Try again.",
		},
		banner: {
			title: "Banner",
			upload: "Upload banner",
			inherit: "Use the first available banner in localization order",
			failed: "The banner could not be uploaded. Try again.",
		},
		cover: {
			title: "Cover",
			upload: "Upload cover",
			inherit: "Use the first available cover in localization order",
			failed: "The cover could not be uploaded. Try again.",
		},
	},
} satisfies typeof import("../zh-Hant/media").default;
