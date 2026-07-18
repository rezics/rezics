import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth/minimal";

import { env } from "../config";
import { database } from "../database";
import * as schema from "../database/schema/auth";
import { getRequestTranslation } from "../i18n";
import { sendMail } from "../mailer";

export const CredentialControlFreshAgeSeconds = 60 * 10;

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
	disabledPaths: [
		"/api-key/create",
		"/api-key/get",
		"/api-key/list",
		"/api-key/update",
		"/api-key/delete",
	],
	plugins: [
		apiKey({
			references: "user",
			defaultPrefix: "rz_api_",
			defaultKeyLength: 64,
			requireName: true,
			minimumNameLength: 1,
			maximumNameLength: 120,
			startingCharactersConfig: { shouldStore: true, charactersLength: 14 },
			keyExpiration: {
				defaultExpiresIn: 60 * 60 * 24 * 90,
				disableCustomExpiresTime: false,
				minExpiresIn: 1,
				maxExpiresIn: 365,
			},
			rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 300 },
			enableSessionForAPIKeys: false,
			storage: "database",
			deferUpdates: false,
		}),
	],
	session: {
		// Credential control-plane routes use this as their re-authentication window.
		freshAge: CredentialControlFreshAgeSeconds,
	},
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
