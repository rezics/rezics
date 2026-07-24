import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth/minimal";
import { getActiveObservability } from "@rezics/observability";

import { env } from "../config";
import { database } from "../database";
import * as schema from "../database/schema/auth";
import { enqueueAuthenticationEmail } from "../email/outbox";
import { getRequestTranslation } from "../i18n";

const { logger } = getActiveObservability();

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
			disableKeyHashing: false,
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
				maxExpiresIn: 60 * 60 * 24 * 365,
			},
			// Emergency platform ceiling. Product limits are enforced by the application access guard.
			rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 5_000 },
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
			const { locale } = await getRequestTranslation("emails", request?.headers);
			void enqueueAuthenticationEmail({
				actionUrl: url,
				kind: "reset_password",
				locale,
				recipientEmail: user.email,
			}).catch((error: unknown) => {
				logger.error("Failed to queue password reset email", {
					eventName: "email.password_reset.enqueue_failed",
					errorCode: "PasswordResetEmailEnqueueFailed",
					error,
				});
			});
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		async sendVerificationEmail({ user, url }, request) {
			const { locale } = await getRequestTranslation("emails", request?.headers);
			void enqueueAuthenticationEmail({
				actionUrl: url,
				kind: "verify_email",
				locale,
				recipientEmail: user.email,
			}).catch((error: unknown) => {
				logger.error("Failed to queue verification email", {
					eventName: "email.verification.enqueue_failed",
					errorCode: "VerificationEmailEnqueueFailed",
					error,
				});
			});
		},
	},
});
