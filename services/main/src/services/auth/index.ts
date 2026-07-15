import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth/minimal";

import { env } from "../config";
import { database } from "../database";
import * as schema from "../database/schema/auth";
import { getRequestTranslation } from "../i18n";
import { sendMail } from "../mailer";

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	basePath: "/api/auth",
	secret: env.BETTER_AUTH_SECRET,
	trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
	database: drizzleAdapter(database, {
		provider: "pg",
		schema,
		usePlural: true,
	}),
	advanced: {
		database: {
			generateId: "uuid",
		},
	},
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		revokeSessionsOnPasswordReset: true,
		async sendResetPassword({ user, url }, request) {
			const { data: translation } = await getRequestTranslation(request?.headers);
			void sendMail({
				to: user.email,
				...translation.emails.resetPassword(url),
			}).catch((error: unknown) => {
				console.error("Failed to send password reset email", error);
			});
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		async sendVerificationEmail({ user, url }, request) {
			const { data: translation } = await getRequestTranslation(request?.headers);
			void sendMail({
				to: user.email,
				...translation.emails.verifyEmail(url),
			}).catch((error: unknown) => {
				console.error("Failed to send verification email", error);
			});
		},
	},
});
