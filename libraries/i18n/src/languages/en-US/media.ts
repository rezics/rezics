export default {
	choose: "Choose, drop, or paste an image",
	hint: "JPEG, PNG, WebP, or AVIF, up to 10 MiB",
	replace: "Replace",
	remove: "Remove",
	cancel: "Cancel",
	invalid: "Choose a JPEG, PNG, WebP, or AVIF image under 10 MiB.",
	current: "Current language override",
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
} satisfies typeof import("../zh-CN/media").default;
