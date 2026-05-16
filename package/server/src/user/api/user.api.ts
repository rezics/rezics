import { Elysia } from "elysia";
import { adminRoute } from "./user.admin.api";
import { userBatchApi } from "./user-batch.api";
import { coreRoute } from "./user.core.api";
import { userEmailVerificationApi } from "./user.email-verification.api";
import { settingsRoute } from "./user.settings.api";
import { userSubscriptionRoute } from "./user.subscription.api";

/**
 * User Controller - Elysia.js routes with JWT authentication.
 *
 * The legacy `followRoute` (user.follow.api.ts) was retired by the
 * `engagement-subscription` change. `userSubscriptionRoute` keeps the
 * user-shaped read endpoints (`GET /:userId/followers`, `/followings`,
 * `/follow/status`, `/follow/summary`) consumed by the
 * profile-followers-tab, now backed by `Subscription` filtered to
 * USER→USER edges. Subscribe/unsubscribe actions go through the
 * generic `/subscription/*` endpoints.
 */
export const userApi = new Elysia({ prefix: "/user" })
  .use(userBatchApi)
  .use(coreRoute)
  .use(adminRoute)
  .use(userSubscriptionRoute)
  .use(userEmailVerificationApi)
  .use(settingsRoute);
