import {
  BasicAdminPermission,
  echoKvKeyListQuerySchema,
  echoKvKeyListResponseSchema,
  echoKvResponseSchema,
  echoKvUpsertRequestSchema,
  type EchoKvKeyListResponse,
  type EchoKvResponse,
  type EchoKvUpsertRequest,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { echoKvService } from "./echokv.service";

export const echoKvApi = new Elysia({ prefix: "/echokv" })
  .use(authMacro)
  // @convention:get-only-ok — dev tool, no batch-id use case
  .get(
    "/list",
    async ({ query }): Promise<EchoKvKeyListResponse> => {
      const keys = await echoKvService.listKeys(query.search);
      return { keys };
    },
    {
      query: echoKvKeyListQuerySchema,
      response: { 200: echoKvKeyListResponseSchema },
      detail: {
        summary: "List keys",
        description: "List all keys with an optional search string.",
        tags: ["EchoKV"],
      },
    },
  )
  .get(
    "/:key",
    async ({ params }): Promise<EchoKvResponse> => {
      const value = await echoKvService.get(params.key);
      return { value };
    },
    {
      params: t.Object({
        key: t.String(),
      }),
      response: { 200: echoKvResponseSchema },
      detail: {
        summary: "Get value by key",
        description: "Get value by key",
        tags: ["EchoKV"],
      },
    },
  )
  .put(
    "/:key",
    async ({ params, body, identity, set }): Promise<EchoKvResponse> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: You are not authorized to update EchoKV");
      }
      const value = await echoKvService.set(
        params.key,
        body.value as EchoKvUpsertRequest["value"],
      );
      return { value };
    },
    {
      requireLogin: true,
      params: t.Object({
        key: t.String(),
      }),
      body: echoKvUpsertRequestSchema,
      response: { 200: echoKvResponseSchema },
      detail: {
        summary: "Upsert value by key",
        description:
          "Create or update a value by key in the EchoKV store. Existing keys are updated, new keys are created.",
        tags: ["EchoKV"],
      },
    },
  );
