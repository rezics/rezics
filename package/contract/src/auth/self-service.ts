import {t} from 'elysia';

export const authProviderIdSchema = t.Union([
  t.Literal('google'),
  t.Literal('microsoft'),
  t.Literal('github'),
  t.Literal('twitter'),
]);
export type AuthProviderId = (typeof authProviderIdSchema)['static'];

export const authProviderSchema = t.Object({
  id: authProviderIdSchema,
  enabled: t.Boolean(),
});
export type AuthProvider = (typeof authProviderSchema)['static'];

export const authSessionStateSchema = t.Object({
  email: t.String({format: 'email'}),
  emailVerified: t.Boolean(),
  needsEmailVerification: t.Boolean(),
  hasPassword: t.Boolean(),
  canSetPassword: t.Boolean(),
  providerIds: t.Array(authProviderIdSchema),
  primaryProviderId: t.Optional(authProviderIdSchema),
  trustedProviderId: t.Optional(authProviderIdSchema),
});
export type AuthSessionState = (typeof authSessionStateSchema)['static'];

export const getSessionStateResponseSchema = t.Object({
  session: t.Object({
    id: t.String(),
    token: t.String(),
    expiresAt: t.String(),
    userId: t.String(),
  }),
  user: t.Object({
    id: t.String(),
    name: t.String(),
    role: t.String(),
    email: t.String(),
    emailVerified: t.Boolean(),
    image: t.Optional(t.Nullable(t.String())),
    createdAt: t.String(),
    updatedAt: t.String(),
  }),
  authSession: authSessionStateSchema,
});
export type GetSessionStateResponse =
  (typeof getSessionStateResponseSchema)['static'];

export const listAuthProvidersResponseSchema = t.Object({
  providers: t.Array(authProviderSchema),
});
export type ListAuthProvidersResponse =
  (typeof listAuthProvidersResponseSchema)['static'];

export const signInSocialBodySchema = t.Object({
  provider: authProviderIdSchema,
  callbackURL: t.Optional(t.String()),
  newUserCallbackURL: t.Optional(t.String()),
  errorCallbackURL: t.Optional(t.String()),
  disableRedirect: t.Optional(t.Boolean()),
});
export type SignInSocialBody = (typeof signInSocialBodySchema)['static'];

export const signInSocialResponseSchema = t.Object({
  url: t.String(),
  redirect: t.Boolean(),
});
export type SignInSocialResponse = (typeof signInSocialResponseSchema)['static'];

export const sendVerificationEmailBodySchema = t.Object({
  email: t.String({format: 'email'}),
  callbackURL: t.Optional(t.String()),
});
export type SendVerificationEmailBody =
  (typeof sendVerificationEmailBodySchema)['static'];

export const sendVerificationEmailResponseSchema = t.Object({
  status: t.Boolean(),
});
export type SendVerificationEmailResponse =
  (typeof sendVerificationEmailResponseSchema)['static'];

export const verifyEmailQuerySchema = t.Object({
  token: t.String(),
  callbackURL: t.Optional(t.String()),
});
export type VerifyEmailQuery = (typeof verifyEmailQuerySchema)['static'];

export const verifyEmailResponseSchema = t.Object({
  status: t.Boolean(),
  user: t.Optional(
    t.Nullable(
      t.Object({
        id: t.String(),
        name: t.String(),
        role: t.String(),
        email: t.String(),
        emailVerified: t.Boolean(),
        image: t.Optional(t.Nullable(t.String())),
        createdAt: t.String(),
        updatedAt: t.String(),
      }),
    ),
  ),
});
export type VerifyEmailResponse = (typeof verifyEmailResponseSchema)['static'];

export const changeEmailBodySchema = t.Object({
  newEmail: t.String({format: 'email'}),
  callbackURL: t.Optional(t.String()),
});
export type ChangeEmailBody = (typeof changeEmailBodySchema)['static'];

export const changeEmailResponseSchema = t.Object({
  status: t.Boolean(),
  message: t.Optional(t.Nullable(t.String())),
});
export type ChangeEmailResponse = (typeof changeEmailResponseSchema)['static'];

export const setPasswordBodySchema = t.Object({
  newPassword: t.String(),
});
export type SetPasswordBody = (typeof setPasswordBodySchema)['static'];

export const setPasswordResponseSchema = t.Object({
  status: t.Boolean(),
});
export type SetPasswordResponse = (typeof setPasswordResponseSchema)['static'];
