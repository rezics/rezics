import {
  createJwtServiceInputSchema,
  jwtServiceDTOSchema,
  jwtServiceListResponseSchema,
  updateJwtServiceInputSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, verifyRootFromDb } from "@/middleware";
import { jwtServiceAdminService } from "./jwt.admin.service";

export const jwtServiceAdminApi = new Elysia({ prefix: "/admin/jwt-services" })
  .use(authMacro)
  .get(
    "/list",
    async ({ identity, status }) => {
      if (identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Root role required");
      }
      const isRoot = await verifyRootFromDb(identity.unitId);
      if (!isRoot) return status(403, "Forbidden: Root role required");

      const services = await jwtServiceAdminService.list();
      return { services };
    },
    {
      requireLogin: true,
      response: {
        200: jwtServiceListResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "List all JWT services",
        tags: ["Admin", "JWT Service"],
      },
    },
  )
  .get(
    "/:serviceKey",
    async ({ params, identity, set, status }) => {
      if (identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Root role required");
      }
      const isRoot = await verifyRootFromDb(identity.unitId);
      if (!isRoot) return status(403, "Forbidden: Root role required");

      const service = await jwtServiceAdminService.fetch(params.serviceKey);
      if (!service) {
        set.status = 404;
        throw new Error(`JwtService not found: ${params.serviceKey}`);
      }
      return service;
    },
    {
      requireLogin: true,
      params: t.Object({ serviceKey: t.String() }),
      response: {
        200: jwtServiceDTOSchema,
        403: t.String(),
      },
      detail: {
        summary: "Fetch a JWT service by serviceKey",
        tags: ["Admin", "JWT Service"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity, set, status }) => {
      if (identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Root role required");
      }
      const isRoot = await verifyRootFromDb(identity.unitId);
      if (!isRoot) return status(403, "Forbidden: Root role required");

      const service = await jwtServiceAdminService.create(body);
      set.status = 201;
      return service;
    },
    {
      requireLogin: true,
      body: createJwtServiceInputSchema,
      response: {
        200: jwtServiceDTOSchema,
        403: t.String(),
      },
      detail: {
        summary: "Create a JWT service",
        tags: ["Admin", "JWT Service"],
      },
    },
  )
  .patch(
    "/:serviceKey",
    async ({ params, body, identity, set, status }) => {
      if (identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Root role required");
      }
      const isRoot = await verifyRootFromDb(identity.unitId);
      if (!isRoot) return status(403, "Forbidden: Root role required");

      if (body.jwksUrl !== undefined) {
        try {
          new URL(body.jwksUrl);
        } catch {
          set.status = 422;
          throw new Error(`Invalid URL for jwksUrl: ${body.jwksUrl}`);
        }
      }
      return await jwtServiceAdminService.update(params.serviceKey, body);
    },
    {
      requireLogin: true,
      params: t.Object({ serviceKey: t.String() }),
      body: updateJwtServiceInputSchema,
      response: {
        200: jwtServiceDTOSchema,
        403: t.String(),
      },
      detail: {
        summary: "Update a JWT service",
        tags: ["Admin", "JWT Service"],
      },
    },
  )
  .post(
    "/:serviceKey/activate",
    async ({ params, identity, status }) => {
      if (identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Root role required");
      }
      const isRoot = await verifyRootFromDb(identity.unitId);
      if (!isRoot) return status(403, "Forbidden: Root role required");

      return await jwtServiceAdminService.activate(params.serviceKey);
    },
    {
      requireLogin: true,
      params: t.Object({ serviceKey: t.String() }),
      response: {
        200: jwtServiceDTOSchema,
        403: t.String(),
      },
      detail: {
        summary: "Activate a JWT service",
        tags: ["Admin", "JWT Service"],
      },
    },
  )
  .post(
    "/:serviceKey/deactivate",
    async ({ params, identity, status }) => {
      if (identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Root role required");
      }
      const isRoot = await verifyRootFromDb(identity.unitId);
      if (!isRoot) return status(403, "Forbidden: Root role required");

      return await jwtServiceAdminService.deactivate(params.serviceKey);
    },
    {
      requireLogin: true,
      params: t.Object({ serviceKey: t.String() }),
      response: {
        200: jwtServiceDTOSchema,
        403: t.String(),
      },
      detail: {
        summary: "Deactivate a JWT service",
        tags: ["Admin", "JWT Service"],
      },
    },
  );
