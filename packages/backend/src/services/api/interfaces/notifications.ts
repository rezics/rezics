import { HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware } from "./middlewares/auth.ts";

// Placeholder group — notify service will be ported later
// 占位组——通知服务后续迁入

export class NotificationsGroup extends HttpApiGroup.make("notifications")
  .middleware(AuthMiddleware)
  .prefix("/notifications") {}
