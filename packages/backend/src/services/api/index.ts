import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi";

import { Auth } from "../auth/index.ts";
import { Config } from "../config/index.ts";
import { Database, DatabasePool } from "../database/index.ts";

// ponytail: self-contained DB layer for handlers / 自包含的 DB 层供处理器使用
const DBLayer = Database.layer.pipe(
  Layer.provide(DatabasePool.layer),
  Layer.provide(Config.layer),
);
import { AdminHandlers } from "./implementations/admin.ts";
import { BooksHandlers } from "./implementations/books.ts";
import { CommentsHandlers } from "./implementations/comments.ts";
import { ContentHandlers } from "./implementations/content.ts";
import {
  ActivityHandlers,
  BlockHandlers,
  DraftHandlers,
  FeedbackHandlers,
  ProgressHandlers,
  ReactionHandlers,
  StreamHandlers,
  SubscriptionHandlers,
} from "./implementations/engagement.ts";
import {
  CreditAttributionHandlers,
  EntitiesHandlers,
  EntityAttributionHandlers,
  SubjectAttributionHandlers,
} from "./implementations/entities.ts";
import { GovernanceHandlers } from "./implementations/governance.ts";
import { HealthHandlers } from "./implementations/health.ts";
import { AuthMiddlewareLive, OptionalAuthMiddlewareLive } from "./implementations/middlewares/auth.ts";
import { NotificationsHandlers } from "./implementations/notifications.ts";
import { PollsHandlers } from "./implementations/polls.ts";
import { PostsHandlers } from "./implementations/posts.ts";
import {
  RealmTagApplicationVotesHandlers,
  RealmTagApplicationsHandlers,
  RealmTagContextsHandlers,
  RealmsHandlers,
} from "./implementations/realms.ts";
import { ScoresHandlers } from "./implementations/scores.ts";
import { SearchHandlers } from "./implementations/search.ts";
import {
  PolicyTagHandlers,
  TagVoteHandlers,
  TagsHandlers,
  UnitTagHandlers,
  UserTagApplicationHandlers,
} from "./implementations/tags.ts";
import { UnitsHandlers } from "./implementations/units.ts";
import { UploadHandlers } from "./implementations/upload.ts";
import { ProfileHandlers, UsersHandlers } from "./implementations/users.ts";
import { ZonesHandlers } from "./implementations/zones.ts";
import { Api as Interfaces } from "./interfaces/index.ts";
import { AuthRoutes } from "./routes/auth.ts";

export const Api = HttpApiBuilder.layer(Interfaces, {
  openapiPath: "/api/openapi.json",
}).pipe(
  Layer.provide([
    // Domain handlers / 领域处理器
    HealthHandlers,
    UnitsHandlers,
    BooksHandlers,
    PostsHandlers,
    CommentsHandlers,
    PollsHandlers,
    RealmsHandlers,
    RealmTagApplicationsHandlers,
    RealmTagApplicationVotesHandlers,
    RealmTagContextsHandlers,
    UploadHandlers,
    ContentHandlers,
    AdminHandlers,
    NotificationsHandlers,
    UsersHandlers,
    GovernanceHandlers,
    SearchHandlers,
    EntitiesHandlers,
    EntityAttributionHandlers,
    CreditAttributionHandlers,
    SubjectAttributionHandlers,
    ZonesHandlers,
    ProfileHandlers,
    TagsHandlers,
    UnitTagHandlers,
    TagVoteHandlers,
    PolicyTagHandlers,
    UserTagApplicationHandlers,
    ScoresHandlers,
    SubscriptionHandlers,
    ReactionHandlers,
    FeedbackHandlers,
    BlockHandlers,
    ProgressHandlers,
    DraftHandlers,
    ActivityHandlers,
    StreamHandlers,

    // Auth & infrastructure / 认证与基础设施
    AuthRoutes.pipe(Layer.provide(Auth.layer), Layer.provide(DatabasePool.layer), Layer.provide(Config.layer)),
    AuthMiddlewareLive.pipe(Layer.provide(Auth.layer), Layer.provide(DatabasePool.layer), Layer.provide(Config.layer)),
    OptionalAuthMiddlewareLive.pipe(Layer.provide(Auth.layer), Layer.provide(DatabasePool.layer), Layer.provide(Config.layer)),
    HttpApiScalar.layer(Interfaces, { path: "/api/docs" }),
    Layer.unwrap(
      Effect.gen(function* () {
        const config = yield* Config;
        return HttpRouter.cors({
          allowedOrigins: config.server.corsOrigins,
          credentials: true,
        });
      }),
    ),
  ]),
  // ponytail: satisfy handler deps (Database, Config) / 满足处理器依赖（Database、Config）
  Layer.provide(DBLayer),
  Layer.provide(Config.layer),
);
