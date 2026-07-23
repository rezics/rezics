import { defineTranslationBundle } from "native-i18n";
import type { resources } from "@rezics/i18n/resources";

const defineBundle = defineTranslationBundle<typeof resources>();

export const RootTranslationNamespaces = defineBundle([
	"actions",
	"auth",
	"betterAuthErrorCodes",
	"brand",
	"editor",
	"errorCodes",
	"errors",
	"routes",
	"search",
	"state",
	"ui",
]);

export const AppShellTranslationNamespaces = defineBundle(["locale", "nav", "notifications"]);
