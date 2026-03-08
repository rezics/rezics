import {t} from 'elysia';

export const requestPasswordResetBodySchema = t.Object({
  email: t.String({format: 'email'}),
  redirectTo: t.Optional(t.String()),
});
export type RequestPasswordResetBody =
  (typeof requestPasswordResetBodySchema)['static'];

export const requestPasswordResetResponseSchema = t.Object({
  status: t.Boolean(),
  message: t.String(),
});
export type RequestPasswordResetResponse =
  (typeof requestPasswordResetResponseSchema)['static'];

export const resetPasswordCallbackParamsSchema = t.Object({
  token: t.String(),
});
export type ResetPasswordCallbackParams =
  (typeof resetPasswordCallbackParamsSchema)['static'];

export const resetPasswordCallbackQuerySchema = t.Object({
  callbackURL: t.String(),
});
export type ResetPasswordCallbackQuery =
  (typeof resetPasswordCallbackQuerySchema)['static'];

export const resetPasswordCallbackResponseSchema = t.Object({
  token: t.String(),
});
export type ResetPasswordCallbackResponse =
  (typeof resetPasswordCallbackResponseSchema)['static'];

export const resetPasswordBodySchema = t.Object({
  newPassword: t.String(),
  token: t.Optional(t.String()),
});
export type ResetPasswordBody = (typeof resetPasswordBodySchema)['static'];

export const resetPasswordResponseSchema = t.Object({
  status: t.Boolean(),
});
export type ResetPasswordResponse =
  (typeof resetPasswordResponseSchema)['static'];
