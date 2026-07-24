import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	layout: {
		automatedMessage: "This is an automated message. Please do not reply to this email.",
		copyright: insert(`© {{year}} ${verbatimTerms.rezics.value}. All rights reserved.`, {
			year: Number,
		}),
	},
	resetPassword: {
		subject: `Reset your ${verbatimTerms.rezics.value} password`,
		preview: `Reset your ${verbatimTerms.rezics.value} password`,
		heading: "Reset your password",
		body: "We received a request to reset your account password. Use the button below within one hour to choose a new password.",
		actionLabel: "Reset password",
		fallback: "If the button does not work, open this link:",
		ignoreNotice:
			"If you did not make this request, you can ignore this email. Your password will not change.",
	},
	verifyEmail: {
		subject: `Verify your ${verbatimTerms.rezics.value} email address`,
		preview: `Verify your ${verbatimTerms.rezics.value} email address`,
		heading: "Verify your email",
		body: "Confirm that this email address belongs to you to finish setting up your account.",
		actionLabel: "Verify email",
		fallback: "If the button does not work, open this link:",
		ignoreNotice:
			"If you did not create an account or request verification, you can ignore this email.",
	},
} satisfies typeof import("../zh-Hant/emails").default;
