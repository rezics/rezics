import { Elysia } from "elysia";
import { adminRoute } from "./user.admin.api";
import { userBatchApi } from "./user-batch.api";
import { coreRoute } from "./user.core.api";
import { userEmailVerificationApi } from "./user.email-verification.api";
import { followRoute } from "./user.follow.api";
import { settingsRoute } from "./user.settings.api";

/**
 * User Controller - Elysia.js routes with JWT authentication
 */
export const userApi = new Elysia({ prefix: "/user" })
  .use(userBatchApi)
  .use(coreRoute)
  .use(adminRoute)
  .use(followRoute)
  .use(userEmailVerificationApi)
  .use(settingsRoute);
