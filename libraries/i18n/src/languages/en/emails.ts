import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	resetPassword: {
		subject: `Reset your ${verbatimTerms.rezics.value} password`,
		text: insert("Open this link within one hour to reset your password: {{url}}", {
			url: String,
		}),
	},
	verifyEmail: {
		subject: `Verify your ${verbatimTerms.rezics.value} email address`,
		text: insert("Open this link to verify your email address: {{url}}", { url: String }),
	},
} satisfies typeof import("../zh-Hant/emails").default;
