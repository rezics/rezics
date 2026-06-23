import { Effect, Layer, Option } from "effect";
import { isNotNullish } from "effect/Predicate";
import { HttpServerRequest } from "effect/unstable/http";

import { Auth } from "../../../auth/index.ts";
import {
  AuthMiddleware,
  CurrentSession,
  CurrentUser,
  CurrentUserOption,
  OptionalAuthMiddleware,
  Unauthorized,
} from "../../interfaces/middlewares/auth.ts";

export const AuthMiddlewareLive = Layer.effect(
  AuthMiddleware,
  Effect.gen(function* () {
    const auth = yield* Auth;

    return (next) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const headers = new globalThis.Headers(request.headers);

        const result = yield* auth.api.getSession({ headers }).pipe(
          Effect.filterOrFail(isNotNullish),
          Effect.catchTag("NoSuchElementError", () => Effect.fail(new Unauthorized())),
          Effect.catchTag("API", () => Effect.fail(new Unauthorized())),
          Effect.catchTag("Unknown", () => Effect.fail(new Unauthorized())),
        );

        return yield* next.pipe(
          Effect.provideService(CurrentSession, result.session),
          Effect.provideService(CurrentUser, result.user),
        );
      });
  }),
);

export const OptionalAuthMiddlewareLive = Layer.effect(
  OptionalAuthMiddleware,
  Effect.gen(function* () {
    const auth = yield* Auth;

    return (next) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const headers = new globalThis.Headers(request.headers);

        const user = yield* auth.api.getSession({ headers }).pipe(
          Effect.map((result) => Option.fromNullishOr(result?.user)),
          Effect.catchTag("API", () => Effect.succeed(Option.none())),
          Effect.catchTag("Unknown", () => Effect.succeed(Option.none())),
        );

        return yield* next.pipe(Effect.provideService(CurrentUserOption, user));
      });
  }),
);
