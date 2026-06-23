import { Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { Auth } from "../../auth/index.ts";

export const AuthRoutes = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    yield* router.add(
      "*",
      "/api/auth/*",
      HttpServerRequest.HttpServerRequest.pipe(
        Effect.flatMap(HttpServerRequest.toWeb),
        Effect.flatMap((request) => Effect.promise(() => auth.handler(request))),
        Effect.map(HttpServerResponse.fromWeb),
      ),
    );
  }),
);
