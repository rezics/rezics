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
	editPresentation: "Adjust displayed area",
	presentationEditor: {
		title: {
			avatar: "Adjust avatar",
			banner: "Adjust banner",
			cover: "Adjust cover",
		},
		description: {
			avatar: "Drag and zoom the image inside the square crop. The circular avatar preview does not remove the original corners.",
			banner: "Drag and zoom the image inside the fixed 4:1 crop. New banners start from the top-left.",
			cover: "Keep the complete image by default, or switch to a fixed 3:4 crop when composition matters more.",
		},
		close: "Close image adjustment",
		loading: "Loading the original image…",
		loadFailed: "The original image or its presentation could not be loaded.",
		cropArea:
			"Image crop area. Drag to reposition, use the mouse wheel to zoom, or use arrow keys to move.",
		zoom: "Zoom",
		zoomIn: "Zoom in",
		zoomOut: "Zoom out",
		reset: "Reset",
		avatarPreview: "Circular preview",
		bannerPreview: "Banner preview",
		coverPreview: "Complete cover preview",
		coverMode: {
			label: "Cover display mode",
			contain: "Show complete image",
			crop: "Crop to 3:4",
			containDescription:
				"The complete image remains visible. The frame uses a blurred backdrop when its proportions differ.",
			cropDescription: "Only the selected 3:4 area is delivered and displayed.",
		},
		cancel: "Cancel",
		save: "Save displayed area",
		saveFailed: "The displayed area could not be saved. Try again.",
	},
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
			featured: "Common icons",
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
		description: "The delivered banner uses the saved 4:1 area.",
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
