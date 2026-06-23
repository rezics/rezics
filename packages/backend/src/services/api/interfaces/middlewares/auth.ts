import { Context, Schema, type Option } from "effect";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly token: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly image?: string | null;
  readonly displayName?: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class CurrentSession extends Context.Service<CurrentSession, Session>()(
  "@rezics/api/CurrentSession",
) {}

export class CurrentUser extends Context.Service<CurrentUser, User>()("@rezics/api/CurrentUser") {}

export class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>()(
  "Unauthorized",
  {},
  { httpApiStatus: 401 },
) {}

export class AuthMiddleware extends HttpApiMiddleware.Service<
  AuthMiddleware,
  { provides: CurrentSession | CurrentUser }
>()("@rezics/api/AuthMiddleware", {
  error: Unauthorized,
}) {}

export class CurrentUserOption extends Context.Service<CurrentUserOption, Option.Option<User>>()(
  "@rezics/api/CurrentUserOption",
) {}

export class OptionalAuthMiddleware extends HttpApiMiddleware.Service<
  OptionalAuthMiddleware,
  { provides: CurrentUserOption }
>()("@rezics/api/OptionalAuthMiddleware") {}
