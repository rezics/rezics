import { HttpApi, OpenApi } from "effect/unstable/httpapi";

import { AdminGroup } from "./admin.ts";
import { BooksGroup } from "./books.ts";
import { CommentsGroup } from "./comments.ts";
import { ContentGroup } from "./content.ts";
import {
  ActivityGroup,
  BlockGroup,
  DraftGroup,
  FeedbackGroup,
  ProgressGroup,
  ReactionGroup,
  StreamGroup,
  SubscriptionGroup,
} from "./engagement.ts";
import {
  CreditAttributionGroup,
  EntitiesGroup,
  EntityAttributionGroup,
  SubjectAttributionGroup,
} from "./entities.ts";
import { GovernanceGroup } from "./governance.ts";
import { HealthGroup } from "./health.ts";
import { NotificationsGroup } from "./notifications.ts";
import { PollsGroup } from "./polls.ts";
import { PostsGroup } from "./posts.ts";
import {
  RealmsGroup,
  RealmTagApplicationsGroup,
  RealmTagApplicationVotesGroup,
  RealmTagContextsGroup,
} from "./realms.ts";
import { ScoresGroup } from "./scores.ts";
import { SearchGroup } from "./search.ts";
import {
  PolicyTagGroup,
  TagVoteGroup,
  TagsGroup,
  UnitTagGroup,
  UserTagApplicationGroup,
} from "./tags.ts";
import { UnitsGroup } from "./units.ts";
import { UploadGroup } from "./upload.ts";
import { ProfileGroup, UsersGroup } from "./users.ts";
import { ZonesGroup } from "./zones.ts";

export class Api extends HttpApi.make("api")
  .add(HealthGroup)
  .add(UnitsGroup)
  .add(BooksGroup)
  .add(PostsGroup)
  .add(CommentsGroup)
  .add(PollsGroup)
  .add(RealmsGroup)
  .add(RealmTagApplicationsGroup)
  .add(RealmTagApplicationVotesGroup)
  .add(RealmTagContextsGroup)
  .add(UploadGroup)
  .add(ContentGroup)
  .add(AdminGroup)
  .add(NotificationsGroup)
  .add(UsersGroup)
  .add(GovernanceGroup)
  .add(SearchGroup)
  .add(EntitiesGroup)
  .add(EntityAttributionGroup)
  .add(CreditAttributionGroup)
  .add(SubjectAttributionGroup)
  .add(ZonesGroup)
  .add(ProfileGroup)
  .add(TagsGroup)
  .add(UnitTagGroup)
  .add(TagVoteGroup)
  .add(PolicyTagGroup)
  .add(UserTagApplicationGroup)
  .add(ScoresGroup)
  .add(SubscriptionGroup)
  .add(ReactionGroup)
  .add(FeedbackGroup)
  .add(BlockGroup)
  .add(ProgressGroup)
  .add(DraftGroup)
  .add(ActivityGroup)
  .add(StreamGroup)
  .prefix("/api")
  .annotateMerge(
    OpenApi.annotations({
      title: "rezics API",
      version: "0.1.0",
    }),
  ) {}

export * from "./admin.ts";
export * from "./books.ts";
export * from "./comments.ts";
export * from "./content.ts";
export * from "./engagement.ts";
export * from "./entities.ts";
export * from "./governance.ts";
export * from "./health.ts";
export * from "./middlewares/auth.ts";
export * from "./notifications.ts";
export * from "./polls.ts";
export * from "./posts.ts";
export * from "./realms.ts";
export * from "./scores.ts";
export * from "./search.ts";
export * from "./tags.ts";
export * from "./units.ts";
export * from "./upload.ts";
export * from "./users.ts";
export * from "./zones.ts";
