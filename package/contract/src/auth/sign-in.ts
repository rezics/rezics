import { t } from "elysia";

export const signInBodySchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String(),
});
export type SignInBody = (typeof signInBodySchema)["static"];

export const signUpBodySchema = t.Object({
  name: t.String(),
  email: t.String({ format: "email" }),
  password: t.String(),
});
export type SignUpBody = (typeof signUpBodySchema)["static"];

export const authUserSchema = t.Object({
  id: t.String(),
  name: t.String(),
  role: t.String(),
  email: t.String(),
  emailVerified: t.Boolean(),
  image: t.Optional(t.Nullable(t.String())),
  createdAt: t.String(),
  updatedAt: t.String(),
});
export type AuthUser = (typeof authUserSchema)["static"];

export const authSessionSchema = t.Object({
  id: t.String(),
  token: t.String(),
  expiresAt: t.String(),
  userId: t.String(),
});
export type AuthSession = (typeof authSessionSchema)["static"];

export const authResponseSchema = t.Object({
  user: authUserSchema,
  session: authSessionSchema,
  token: t.Optional(t.String()),
});
export type AuthResponse = (typeof authResponseSchema)["static"];

export const signOutResponseSchema = t.Object({
  success: t.Boolean(),
});
export type SignOutResponse = (typeof signOutResponseSchema)["static"];
