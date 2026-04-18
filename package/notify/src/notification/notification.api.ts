import {
  markReadBodySchema,
  notificationListBodySchema,
  notificationListQuerySchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "../macro/auth";
import * as notificationService from "./notification.service";

export const notificationApi = new Elysia({ prefix: "/notification" })
  .use(authMacro)
  .get(
    "/list",
    async ({ userId, query }) => {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      return notificationService.getNotifications(userId, page, limit);
    },
    {
      requireUser: true,
      query: notificationListQuerySchema,
      detail: {
        summary: "List notifications",
        description:
          "Returns a paginated list of notifications for the authenticated user.",
        tags: ["Notifications"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    "/list",
    async ({ userId, body }) => {
      const page = Number(body.page ?? 1);
      const limit = Number(body.limit ?? 20);
      return notificationService.getNotifications(userId, page, limit);
    },
    {
      requireUser: true,
      body: notificationListBodySchema,
      detail: {
        summary: "List notifications (POST)",
        description:
          "List notifications via POST body. Use when ids exceed URL length.",
        tags: ["Notifications"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    "/unread-count",
    async ({ userId }) => {
      const count = await notificationService.getUnreadCount(userId);
      return { count };
    },
    {
      requireUser: true,
      detail: {
        summary: "Get unread count",
        description: "Returns the number of unread notifications.",
        tags: ["Notifications"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    "/read",
    async ({ userId, body }) => {
      await notificationService.markAsRead(
        userId,
        body.type,
        body.entityType,
        body.entityId,
      );
      return { success: true };
    },
    {
      requireUser: true,
      body: markReadBodySchema,
      detail: {
        summary: "Mark notification as read",
        description:
          "Marks a specific notification as read by type, entity type, and entity ID.",
        tags: ["Notifications"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    "/read-all",
    async ({ userId }) => {
      await notificationService.markAllAsRead(userId);
      return { success: true };
    },
    {
      requireUser: true,
      detail: {
        summary: "Mark all as read",
        description:
          "Marks all notifications as read for the authenticated user.",
        tags: ["Notifications"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .delete(
    "/:id",
    async ({ userId, params, set }) => {
      const deleted = await notificationService.deleteNotification(
        params.id,
        userId,
      );
      if (!deleted) {
        set.status = 404;
        return { error: "Not found" };
      }
      return { success: true };
    },
    {
      requireUser: true,
      params: t.Object({ id: t.String() }),
      detail: {
        summary: "Delete notification",
        description:
          "Deletes a notification by ID. Returns 404 if not found or not owned by the user.",
        tags: ["Notifications"],
        security: [{ bearerAuth: [] }],
      },
    },
  );
