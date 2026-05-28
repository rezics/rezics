import { dashboardSummarySchema } from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { dashboardService } from "./dashboard.service";

export const dashboardApi = new Elysia().use(authMacro).get(
  "/me/dashboard",
  async ({ identity }) => {
    return dashboardService.summary(identity.userId);
  },
  {
    requireLogin: true,
    response: dashboardSummarySchema,
    detail: {
      summary: "Aggregate the signed-in user's dashboard summary",
      tags: ["Dashboard"],
    },
  },
);
