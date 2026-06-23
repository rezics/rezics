import { HttpApiBuilder } from "effect/unstable/httpapi";

import { Api } from "../interfaces/index.ts";

// ponytail: stub — no endpoints defined yet, implement when porting domain logic
// ponytail: 桩——尚无端点定义，迁入领域逻辑时实现
export const NotificationsHandlers = HttpApiBuilder.group(
  Api,
  "notifications",
  (handlers) => handlers,
);
