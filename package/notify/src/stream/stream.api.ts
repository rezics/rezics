import { Elysia } from "elysia";
import { authMacro } from "../macro/auth";
import { subscribe, unsubscribe } from "./fan-out";

const HEARTBEAT_INTERVAL = 30_000;

export const streamApi = new Elysia({ prefix: "/stream" })
  .use(authMacro)
  .get(
    "/",
    ({ userId, set }) => {
      set.headers["content-type"] = "text/event-stream";
      set.headers["cache-control"] = "no-cache";
      set.headers["connection"] = "keep-alive";

      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();

            const connection = {
              send(data: string) {
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              },
            };

            subscribe(userId, connection);

            // Heartbeat
            const heartbeat = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(":heartbeat\n\n"));
              } catch {
                clearInterval(heartbeat);
              }
            }, HEARTBEAT_INTERVAL);

            // Cleanup on cancel
            const checkClosed = setInterval(() => {
              try {
                controller.enqueue(new Uint8Array(0));
              } catch {
                clearInterval(heartbeat);
                clearInterval(checkClosed);
                unsubscribe(userId, connection);
              }
            }, 5_000);
          },
          cancel() {
            // Stream cancelled by client — cleanup handled by interval checks
          },
        }),
        {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          },
        },
      );
    },
    { requireUser: true },
  );
