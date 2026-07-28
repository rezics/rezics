import { defineResources, type NamespaceContract, type NamespaceOf } from "native-i18n";

/**
 * Copy rendered by backend delivery channels. Chinese intentionally remains a
 * single `zh` locale even though the web UI has separate script locales.
 */
export const serviceResources = defineResources({
	fallbackLocale: "zh",
	loaders: {
		zh: {
			emails: () => import("./languages/zh-Hant/emails").then((module) => module.default),
			notifications: () =>
				import("./languages/zh-Hant/notifications").then((module) => module.default),
		},
		en: {
			emails: () => import("./languages/en/emails").then((module) => module.default),
			notifications: () =>
				import("./languages/en/notifications").then((module) => module.default),
		},
		ja: {
			emails: () => import("./languages/ja/emails").then((module) => module.default),
			notifications: () =>
				import("./languages/ja/notifications").then((module) => module.default),
		},
		ko: {
			emails: () => import("./languages/ko/emails").then((module) => module.default),
			notifications: () =>
				import("./languages/ko/notifications").then((module) => module.default),
		},
		de: {
			emails: () => import("./languages/de/emails").then((module) => module.default),
			notifications: () =>
				import("./languages/de/notifications").then((module) => module.default),
		},
		fr: {
			emails: () => import("./languages/fr/emails").then((module) => module.default),
			notifications: () =>
				import("./languages/fr/notifications").then((module) => module.default),
		},
		es: {
			emails: () => import("./languages/es/emails").then((module) => module.default),
			notifications: () =>
				import("./languages/es/notifications").then((module) => module.default),
		},
	},
});

export type ServiceTranslation = {
	readonly [Namespace in NamespaceOf<typeof serviceResources>]: NamespaceContract<
		typeof serviceResources,
		Namespace
	>;
};
