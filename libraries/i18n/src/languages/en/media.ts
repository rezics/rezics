import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { insert } from "native-i18n";

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
	avatarPicker: {
		setup: "Set up avatar",
		edit: "Edit avatar",
		dialogTitle: "Choose an avatar",
		dialogDescription: "Upload an image, or choose an icon or emoji.",
		close: "Close avatar picker",
		source: "Avatar source",
		useInherited: "Use inherited avatar",
		recent: "Recently used",
		typeLabel: "Avatar type",
		tabs: { image: "Image", icon: "Icon", emoji: "Emoji" },
		preview: "Avatar preview",
		inherited: "Inherited avatar",
		icon: {
			search: "Search icons",
			searchHint: "Enter at least two characters to search for icons",
			style: "Icon style",
			styles: { fas: "Solid", fab: "Brands" },
			loading: "Searching for icons…",
			empty: "No matching icons were found.",
			failed: "Icons cannot be searched right now. Try again later.",
			select: insert("Select icon: {{name}}", { name: String }),
			unconfigured: `${verbatimTerms.fontAwesome.value} ${verbatimTerms.cdn.value} is not configured, so icon previews cannot be displayed.`,
		},
		emoji: {
			search: "Search emoji",
			skinTone: "Change skin tone",
			loading: "Loading emoji…",
			empty: "No matching emoji were found.",
		},
	},
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
			inherit: "Use the first available avatar in localization order",
			failed: "The avatar could not be uploaded. Try again.",
		},
		banner: {
			title: "Banner",
			inherit: "Use the first available banner in localization order",
			failed: "The banner could not be uploaded. Try again.",
		},
		cover: {
			title: "Cover",
			inherit: "Use the first available cover in localization order",
			failed: "The cover could not be uploaded. Try again.",
		},
	},
} satisfies typeof import("../zh-Hant/media").default;
