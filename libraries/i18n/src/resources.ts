import { defineResources, type NamespaceContract, type NamespaceOf } from "native-i18n";

export const resources = defineResources({
	fallbackLocale: "zh-Hant",
	loaders: {
		"zh-Hant": {
			actions: () => import("./languages/zh-Hant/actions").then((module) => module.default),
			auth: () => import("./languages/zh-Hant/auth").then((module) => module.default),
			betterAuthErrorCodes: () =>
				import("./languages/zh-Hant/betterAuthErrorCodes").then((module) => module.default),
			brand: () => import("./languages/zh-Hant/brand").then((module) => module.default),
			catalog: () => import("./languages/zh-Hant/catalog").then((module) => module.default),
			cover: () => import("./languages/zh-Hant/cover").then((module) => module.default),
			create: () => import("./languages/zh-Hant/create").then((module) => module.default),
			previewAccess: () =>
				import("./languages/zh-Hant/previewAccess").then((module) => module.default),
			editor: () => import("./languages/zh-Hant/editor").then((module) => module.default),
			emails: () => import("./languages/zh-Hant/emails").then((module) => module.default),
			engagement: () =>
				import("./languages/zh-Hant/engagement").then((module) => module.default),
			errorCodes: () =>
				import("./languages/zh-Hant/errorCodes").then((module) => module.default),
			errors: () => import("./languages/zh-Hant/errors").then((module) => module.default),
			feed: () => import("./languages/zh-Hant/feed").then((module) => module.default),
			governance: () =>
				import("./languages/zh-Hant/governance").then((module) => module.default),
			history: () => import("./languages/zh-Hant/history").then((module) => module.default),
			home: () => import("./languages/zh-Hant/home").then((module) => module.default),
			locale: () => import("./languages/zh-Hant/locale").then((module) => module.default),
			licenses: () => import("./languages/zh-Hant/licenses").then((module) => module.default),
			media: () => import("./languages/zh-Hant/media").then((module) => module.default),
			nav: () => import("./languages/zh-Hant/nav").then((module) => module.default),
			notifications: () =>
				import("./languages/zh-Hant/notifications").then((module) => module.default),
			posts: () => import("./languages/zh-Hant/posts").then((module) => module.default),
			profiles: () => import("./languages/zh-Hant/profiles").then((module) => module.default),
			realms: () => import("./languages/zh-Hant/realms").then((module) => module.default),
			routes: () => import("./languages/zh-Hant/routes").then((module) => module.default),
			search: () => import("./languages/zh-Hant/search").then((module) => module.default),
			settings: () => import("./languages/zh-Hant/settings").then((module) => module.default),
			staff: () => import("./languages/zh-Hant/staff").then((module) => module.default),
			state: () => import("./languages/zh-Hant/state").then((module) => module.default),
			tags: () => import("./languages/zh-Hant/tags").then((module) => module.default),
			ui: () => import("./languages/zh-Hant/ui").then((module) => module.default),
			units: () => import("./languages/zh-Hant/units").then((module) => module.default),
			zones: () => import("./languages/zh-Hant/zones").then((module) => module.default),
		},
		en: {
			actions: () => import("./languages/en/actions").then((module) => module.default),
			auth: () => import("./languages/en/auth").then((module) => module.default),
			betterAuthErrorCodes: () =>
				import("./languages/en/betterAuthErrorCodes").then((module) => module.default),
			brand: () => import("./languages/en/brand").then((module) => module.default),
			catalog: () => import("./languages/en/catalog").then((module) => module.default),
			cover: () => import("./languages/en/cover").then((module) => module.default),
			create: () => import("./languages/en/create").then((module) => module.default),
			previewAccess: () =>
				import("./languages/en/previewAccess").then((module) => module.default),
			editor: () => import("./languages/en/editor").then((module) => module.default),
			emails: () => import("./languages/en/emails").then((module) => module.default),
			engagement: () => import("./languages/en/engagement").then((module) => module.default),
			errorCodes: () => import("./languages/en/errorCodes").then((module) => module.default),
			errors: () => import("./languages/en/errors").then((module) => module.default),
			feed: () => import("./languages/en/feed").then((module) => module.default),
			governance: () => import("./languages/en/governance").then((module) => module.default),
			history: () => import("./languages/en/history").then((module) => module.default),
			home: () => import("./languages/en/home").then((module) => module.default),
			locale: () => import("./languages/en/locale").then((module) => module.default),
			licenses: () => import("./languages/en/licenses").then((module) => module.default),
			media: () => import("./languages/en/media").then((module) => module.default),
			nav: () => import("./languages/en/nav").then((module) => module.default),
			notifications: () =>
				import("./languages/en/notifications").then((module) => module.default),
			posts: () => import("./languages/en/posts").then((module) => module.default),
			profiles: () => import("./languages/en/profiles").then((module) => module.default),
			realms: () => import("./languages/en/realms").then((module) => module.default),
			routes: () => import("./languages/en/routes").then((module) => module.default),
			search: () => import("./languages/en/search").then((module) => module.default),
			settings: () => import("./languages/en/settings").then((module) => module.default),
			staff: () => import("./languages/en/staff").then((module) => module.default),
			state: () => import("./languages/en/state").then((module) => module.default),
			tags: () => import("./languages/en/tags").then((module) => module.default),
			ui: () => import("./languages/en/ui").then((module) => module.default),
			units: () => import("./languages/en/units").then((module) => module.default),
			zones: () => import("./languages/en/zones").then((module) => module.default),
		},
	},
});

export type Translation = {
	readonly [Namespace in NamespaceOf<typeof resources>]: NamespaceContract<
		typeof resources,
		Namespace
	>;
};
