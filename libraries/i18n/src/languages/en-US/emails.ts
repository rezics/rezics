export default {
	resetPassword: (url: string) => ({
		subject: "Reset your REZICS password",
		text: `Open this link within one hour to reset your password: ${url}`,
	}),
	verifyEmail: (url: string) => ({
		subject: "Verify your REZICS email address",
		text: `Open this link to verify your email address: ${url}`,
	}),
} satisfies typeof import("../zh-CN/emails").default;
