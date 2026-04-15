import { oauthProvider } from "@better-auth/oauth-provider";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { admin, genericOAuth, jwt, organization } from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins/email-otp";
import { env } from "../env";
import { createAuthNotificationService } from "../notification";
import {
  createBetterAuthJwtAdapter,
  getAuthJwksGracePeriodSeconds,
  getAuthJwksRotationIntervalSeconds,
  getAuthJwtAudience,
  getAuthJwtIssuer,
  getAuthJwtTtlSeconds,
} from "../session/jwt/export";
import { ac, authRoles, organizationRoles } from "./permissions";
import { prisma } from "./prisma";
import {
  buildSocialProviderOptions,
  getTelegramGenericOAuthConfig,
} from "./providers";
import { trustedOrigins } from "./trusted-origins";

const telegramOAuthConfig = getTelegramGenericOAuthConfig();
const notificationService = createAuthNotificationService({
  telegram: {
    enabled: false,
  },
});

export const auth = betterAuth({
  appName: "Rezics Auth",
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  advanced: {
    database: {
      generateId: false, // "serial" for auto-incrementing numeric IDs
    },
  },
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }) =>
      notificationService.sendPasswordResetEmail({
        user: {
          email: user.email,
          name: user.name,
        },
        url,
        token,
      }),
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) =>
      notificationService.sendVerificationEmail({
        user: {
          email: user.email,
          name: user.name,
        },
        url,
        token,
      }),
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "microsoft", "github", "twitter"],
      allowDifferentEmails: false,
    },
  },
  socialProviders: {
    ...buildSocialProviderOptions(),
  },
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url, token }) =>
        notificationService.sendChangeEmailConfirmation({
          user: {
            email: user.email,
            name: user.name,
          },
          newEmail,
          url,
          token,
        }),
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      storeOTP: "hashed",
      sendVerificationOnSignUp: false,
      resendStrategy: "rotate",
      overrideDefaultEmailVerification: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        notificationService
          .sendVerificationOTP({ email, otp, type })
          .catch((err) =>
            console.error("[email-otp] Failed to send verification OTP:", err),
          );
      },
    }),
    jwt({
      jwks: {
        keyPairConfig: {
          alg: "ES256",
        },
        rotationInterval: getAuthJwksRotationIntervalSeconds(),
        gracePeriod: getAuthJwksGracePeriodSeconds(),
      },
      adapter: createBetterAuthJwtAdapter({
        disablePrivateKeyEncryption: false,
      }) as any,
      jwt: {
        issuer: getAuthJwtIssuer(),
        audience: getAuthJwtAudience(),
        expirationTime: `${getAuthJwtTtlSeconds()}s`,
        definePayload: ({
          user,
        }: {
          user: Record<string, unknown> & {
            id: string;
            slug?: string;
            name?: string;
            role?: string;
            emailVerified?: boolean;
          };
        }) => ({
          id: user.id,
          slug: user.slug,
          name: user.name,
          role: user.role,
          scope: "user",
          ...(!user.emailVerified ? { email_verified: false } : {}),
        }),
        getSubject: ({ user }: { user: { id: string } }) => user.id,
      },
    }),
    ...(telegramOAuthConfig
      ? [
          genericOAuth({
            config: [telegramOAuthConfig],
          }),
        ]
      : []),
    oauthProvider({
      scopes: ["openid", "profile", "email", "offline_access", "user"],
      loginPage: "/login",
      consentPage: "/consent",
      grantTypes: ["authorization_code", "refresh_token", "client_credentials"],
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: false,
      accessTokenExpiresIn: getAuthJwtTtlSeconds(),
      idTokenExpiresIn: getAuthJwtTtlSeconds(),
      refreshTokenExpiresIn: 60 * 60 * 24 * 30,
      authorizationResponseIssParameterSupported: true,
      disableJwtPlugin: false,
      disableSignOutSessionOnRevocation: true,
      userInfo: ({
        user,
      }: {
        user: {
          id: string;
          email: string;
          emailVerified: boolean;
          name: string;
        };
      }) => ({
        sub: user.id,
        email: user.email,
        email_verified: user.emailVerified,
        name: user.name,
      }),
      clientPrivileges: ({ action, headers }) => {
        if (action !== "create" && action !== "update") {
          return true;
        }

        const klass = headers.get("x-rezics-client-class") ?? "public";
        if (klass === "trusted") {
          return headers.get("x-rezics-internal") === "1";
        }

        if (klass === "confidential") {
          return true;
        }

        return klass === "public";
      },
      shouldSkipConsent: ({
        client,
      }: {
        client: { type?: string; public?: boolean; skipConsent?: boolean };
      }) => {
        const clientType =
          client.type ?? (client.public ? "public" : "confidential");
        return clientType === "trusted" || Boolean(client.skipConsent);
      },
      endSessionEndpoint: {
        enabled: true,
      },
    }),
    admin({
      ac,
      roles: authRoles,
      defaultRole: "user",
    }),
    organization({
      ac,
      roles: organizationRoles,
      sendInvitationEmail: notificationService.sendInvitationEmail,
    }),
  ],
});
