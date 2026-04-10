import { Elysia } from "elysia";
import { env } from "../env";

export const internalGuard = new Elysia({ name: "macro/internal-guard" })
  .onBeforeHandle(({ headers, set }) => {
    const secret = headers["x-internal-secret"];
    if (secret !== env.NOTIFY_INTERNAL_SECRET) {
      set.status = 401;
      return { error: "Unauthorized: Invalid or missing internal secret" };
    }
  });
