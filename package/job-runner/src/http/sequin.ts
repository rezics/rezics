import { Elysia } from "elysia";
import { isAuthorized } from "../auth";
import { enqueueCommand } from "../queue/enqueue";
import type { QueueLike } from "../queue/types";
import { parseSequinPayload } from "../sequin/parse";
import { routeSequinMessages } from "../sequin/router";

export function createSequinApi(options: {
  queue: QueueLike;
  webhookSecret: string;
}) {
  return new Elysia({ name: "job-runner-sequin" }).post(
    "/webhooks/sequin",
    async ({ body, headers, set }) => {
      if (!isAuthorized(headers, options.webhookSecret)) {
        set.status = 401;
        return { status: "error", message: "Unauthorized" };
      }

      const messages = parseSequinPayload(body);
      if (messages.length === 0) {
        set.status = 400;
        return { status: "error", message: "Malformed Sequin payload" };
      }

      const commands = routeSequinMessages(messages);
      const results = await Promise.all(
        commands.map((command) => enqueueCommand(options.queue, command)),
      );
      return {
        status: "ok",
        received: messages.length,
        enqueued: results.length,
        results,
      };
    },
  );
}
