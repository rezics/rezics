import { insert } from "native-i18n";

export default {
	resetPassword: {
		subject: "Reset your REZICS password",
		text: insert("Open this link within one hour to reset your password: {{url}}", {
			url: String,
		}),
	},
	verifyEmail: {
		subject: "Verify your REZICS email address",
		text: insert("Open this link to verify your email address: {{url}}", { url: String }),
	},
} satisfies typeof import("../zh-Hant/emails").default;
