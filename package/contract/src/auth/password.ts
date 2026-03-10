import {t} from 'elysia';
import {
  changeEmailBodySchema,
  changeEmailResponseSchema,
  sendVerificationEmailBodySchema,
  sendVerificationEmailResponseSchema,
  setPasswordBodySchema,
  setPasswordResponseSchema,
  verifyEmailQuerySchema,
  verifyEmailResponseSchema,
} from './self-service';

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

export {
  changeEmailBodySchema,
  changeEmailResponseSchema,
  sendVerificationEmailBodySchema,
  sendVerificationEmailResponseSchema,
  setPasswordBodySchema,
  setPasswordResponseSchema,
  verifyEmailQuerySchema,
  verifyEmailResponseSchema,
};
export type ChangeEmailBody = (typeof changeEmailBodySchema)['static'];
export type ChangeEmailResponse = (typeof changeEmailResponseSchema)['static'];
export type SendVerificationEmailBody =
  (typeof sendVerificationEmailBodySchema)['static'];
export type SendVerificationEmailResponse =
  (typeof sendVerificationEmailResponseSchema)['static'];
export type SetPasswordBody = (typeof setPasswordBodySchema)['static'];
export type SetPasswordResponse = (typeof setPasswordResponseSchema)['static'];
export type VerifyEmailQuery = (typeof verifyEmailQuerySchema)['static'];
export type VerifyEmailResponse = (typeof verifyEmailResponseSchema)['static'];
