import { insert } from "native-i18n";

export default {
	unknown: "An unexpected error occurred.",
	unknownWithCode: insert("An unexpected error occurred ({{code}}).", { code: String }),
	unauthorized: "Sign in to continue.",
	forbidden: "You do not have permission to do that.",
	notFound: "This content could not be found.",
	conflict: "This content changed. Refresh and try again.",
	invalid: "The submitted content is invalid.",
	unavailable: "The service is temporarily unavailable. Try again later.",
} satisfies typeof import("../zh-Hant/errors").default;
