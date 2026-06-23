import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../interfaces/index.ts";

export const NotificationsHandlers = HttpApiBuilder.group(Api, "notifications", (handlers) => handlers);
