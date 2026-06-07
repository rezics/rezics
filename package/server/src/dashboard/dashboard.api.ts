import {
  dashboardSummaryQuerySchema,
  dashboardSummarySchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { resolveEffectiveReadLanguageInput } from "@/unit/language-resolution";
import { dashboardService } from "./dashboard.service";

export const dashboardApi = new Elysia().use(authMacro).get(
  "/me/dashboard",
  async ({ identity, query }) => {
    return dashboardService.summary(
      identity.userId,
      resolveEffectiveReadLanguageInput({
        languages: query.languages,
        appLocale: query.appLocale,
      }),
    );
  },
  {
    requireLogin: true,
    query: dashboardSummaryQuerySchema,
    response: dashboardSummarySchema,
    detail: {
      summary: "Aggregate the signed-in user's dashboard summary",
      tags: ["Dashboard"],
    },
  },
);
