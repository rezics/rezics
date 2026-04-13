import type { UserSettings } from "@rezics/contract";
import { updateUserSettingsSchema } from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import {
  getSettings,
  updateSettings,
} from "../service/settings.service";

export const settingsRoute = new Elysia()
  .use(authMacro)
  .get(
    "/me/settings",
    async ({ currentUser }): Promise<UserSettings> => {
      return getSettings(currentUser.unitId);
    },
    {
      requireOwner: true,
      detail: {
        summary: "Get user settings",
        description: "Get current user's settings (realm-tag preferences, language preferences)",
        tags: ["Users"],
      },
    },
  )
  .put(
    "/me/settings",
    async ({ currentUser, body }): Promise<UserSettings> => {
      return updateSettings(currentUser.unitId, body);
    },
    {
      requireOwner: true,
      body: updateUserSettingsSchema,
      detail: {
        summary: "Update user settings",
        description: "Deep-merge update current user's settings",
        tags: ["Users"],
      },
    },
  );
