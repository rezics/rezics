import { Elysia } from "elysia";
import { adminRoute } from "./user.admin.api";
import { coreRoute } from "./user.core.api";
import { followRoute } from "./user.follow.api";
import { keywordsRoute } from "./user.keywords.api";

/**
 * User Controller - Elysia.js routes with JWT authentication
 */
export const userApi = new Elysia({ prefix: "/users" })
  .use(coreRoute)
  .use(adminRoute)
  .use(followRoute)
  .use(keywordsRoute);
