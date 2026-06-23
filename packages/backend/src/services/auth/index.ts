import { APIError } from "better-auth";
import { Context, Data, Effect, Layer, Record } from "effect";

import { Config } from "../config";
import { DatabasePool } from "../database";
import { make } from "./make.ts";

export class Auth extends Context.Service<Auth>()("@rezics/backend/Auth", {
  make: Effect.gen(function* () {
    const pool = yield* DatabasePool;
    const config = yield* Config;
    const auth = make(pool, config.server.baseURL);

    type API = {
      [K in keyof typeof auth.api]: (typeof auth.api)[K] extends (...args: infer A) => PromiseLike<infer R>
        ? (...args: A) => Effect.Effect<R, Auth.Error.API | Auth.Error.Unknown>
        : never;
    };

    return {
      ...auth,
      api: Record.map(
        auth.api as globalThis.Record<string, (params: unknown) => PromiseLike<unknown>>,
        (endpoint) => (params: unknown) =>
          Effect.tryPromise({
            try: () => endpoint(params),
            catch: (cause) =>
              cause instanceof APIError ? new Auth.Error.API({ cause }) : new Auth.Error.Unknown({ cause }),
          }),
      ) as unknown as API,
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
