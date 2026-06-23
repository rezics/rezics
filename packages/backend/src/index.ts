import { createServer } from "node:http";

import { NodeHttpServer, NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";

import { Api } from "./services/api";
import { AuthMiddlewareLive, OptionalAuthMiddlewareLive } from "./services/api/implementations/middlewares/auth.ts";
import { Auth } from "./services/auth";
import { Config } from "./services/config";
import { DatabasePool } from "./services/database";

const AuthLayer = Layer.mergeAll(
  Auth.layer,
  AuthMiddlewareLive,
  OptionalAuthMiddlewareLive,
).pipe(
  Layer.provide(Auth.layer),
  Layer.provide(DatabasePool.layer),
  Layer.provide(Config.layer),
);

const program = Effect.gen(function* () {
  const config = yield* Config;
  const handler = yield* HttpRouter.toHttpEffect(Api);

  const server = yield* NodeHttpServer.make(createServer, {
    host: config.server.host,
    port: config.server.port,
  });

  yield* server.serve(handler);
  return yield* Effect.never;
}).pipe(
  Effect.provide(AuthLayer),
  Effect.provide(NodeHttpServer.layerHttpServices),
  Effect.provide(NodeServices.layer),
  Effect.provide(Config.layer),
  Effect.scoped,
);

NodeRuntime.runMain(program);
