import { Elysia } from "elysia";
import { authMacro } from "../macro/auth";
import { subscribe, unsubscribe } from "./fan-out";

const HEARTBEAT_INTERVAL = 30_000;

export const streamApi = new Elysia({ prefix: "/stream" })
  .use(authMacro)
  // @convention:root-list-ok — SSE stream, not a collection
  // @convention:root-list-ok — SSE 流，而非集合
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

            const heartbeat = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(":heartbeat\n\n"));
              } catch {
                clearInterval(heartbeat);
              }
            }, HEARTBEAT_INTERVAL);

            // Cleanup on cancel
            // 取消时清理
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
            // 流被客户端取消——清理由 interval 检查负责
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
    {
      requireUser: true,
      detail: {
        summary: "Notification stream (SSE)",
        description:
          "Opens a Server-Sent Events connection for real-time notification delivery. " +
          "Events are sent as `data: <JSON>` frames. A heartbeat comment is sent every 30 seconds " +
          "to keep the connection alive. The client should reconnect on disconnect.",
        tags: ["Notifications", "Realtime"],
        security: [{ bearerAuth: [] }],
      },
    },
  );
