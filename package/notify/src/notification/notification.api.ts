import {
  markReadBodySchema,
  notificationListQuerySchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "../macro/auth";
import * as notificationService from "./notification.service";

export const notificationApi = new Elysia({ prefix: "/notifications" })
  .use(authMacro)
  .get(
    "/",
    async ({ userId, query }) => {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 20);
      return notificationService.getNotifications(userId, page, limit);
    },
    {
      requireUser: true,
      query: notificationListQuerySchema,
    },
  )
  .get(
    "/unread-count",
    async ({ userId }) => {
      const count = await notificationService.getUnreadCount(userId);
      return { count };
    },
    { requireUser: true },
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
    },
  )
  .post(
    "/read-all",
    async ({ userId }) => {
      await notificationService.markAllAsRead(userId);
      return { success: true };
    },
    { requireUser: true },
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
    },
  );
