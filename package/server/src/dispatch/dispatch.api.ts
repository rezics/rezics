import { DispatchScope, dispatchResultSchema } from "@rezics/contract";
import { Elysia, t } from "elysia";
import { tokenService } from "@/token/token.service";
import { dispatchService } from "./dispatch.service";

export const dispatchApi = new Elysia({ prefix: "/dispatch" }).post(
  "/results",
  async ({ headers, set, body }) => {
    const config = dispatchService.getConfig();
    if (!config) {
      set.status = 503;
      throw new Error("Dispatch service is not configured");
    }

    const { userId, scopes } = await tokenService.authenticateFromHeader(
      headers.authorization,
      { status: set.status as number | undefined },
    );

    if (
      !tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.UNIT_UPDATE,
      )
    ) {
      set.status = 403;
      throw new Error("Forbidden: token lacks dispatch:unit:update scope");
    }

    if (
      !body.unitId &&
      !tokenService.hasScope(
        scopes,
        DispatchScope.DOMAIN,
        DispatchScope.UNIT_CREATE,
      )
    ) {
      set.status = 403;
      throw new Error(
        "Forbidden: token lacks dispatch:unit:create scope (required when unitId is absent)",
      );
    }

    const result = await dispatchService.processResult(body, userId);

    // Fire-and-forget hub notification
    void dispatchService.notifyHub([body.taskId], body.project);

    return { unitId: result.unitId };
  },
  {
    body: dispatchResultSchema,
    headers: t.Object(
      { authorization: t.String() },
      { additionalProperties: true },
    ),
    detail: {
      summary: "Submit dispatch result",
      description:
        "Submit a normalized task result from a dispatch worker. Upserts content by type and notifies the hub.",
      tags: ["Dispatch"],
    },
  },
);
