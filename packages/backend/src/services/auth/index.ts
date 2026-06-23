import { APIError } from "better-auth";
import { Context, Data, Effect, Layer } from "effect";

import { Config } from "../config";
import { DatabasePool } from "../database";
import { make } from "./make.ts";

export class Auth extends Context.Service<Auth>()("@rezics/backend/Auth", {
  make: Effect.gen(function* () {
    const pool = yield* DatabasePool;
    const config = yield* Config;
    const auth = make(pool, config.server.baseURL);

    /**
     * Wrap a single better-auth endpoint to return Effect instead of Promise.
     * 将单个 better-auth 端点包装为返回 Effect 而非 Promise。
     */
    function wrap<A extends unknown[], R>(
      fn: (...args: A) => PromiseLike<R>,
    ): (...args: A) => Effect.Effect<R, Auth.Error.API | Auth.Error.Unknown> {
      return (...args) =>
        Effect.tryPromise({
          try: () => fn(...args),
          catch: (cause) =>
            cause instanceof APIError ? new Auth.Error.API({ cause }) : new Auth.Error.Unknown({ cause }),
        });
    }

    return {
      ...auth,
      api: {
        getSession: wrap(auth.api.getSession),
        listSessions: wrap(auth.api.listSessions),
        revokeSession: wrap(auth.api.revokeSession),
        revokeSessions: wrap(auth.api.revokeSessions),
      },
    };
  }),
}) {}

export namespace Auth {
  export const layer = Layer.effect(Auth, Auth.make);

  export namespace Error {
    export class Unknown extends Data.TaggedError("Unknown")<{
      cause: unknown;
    }> {}
    export class API extends Data.TaggedError("API")<{
      cause: APIError;
    }> {}
  }
}
