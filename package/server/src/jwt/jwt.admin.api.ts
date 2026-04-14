import {
  createJwtServiceInputSchema,
  jwtServiceDTOSchema,
  jwtServiceListResponseSchema,
  updateJwtServiceInputSchema,
} from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { authMacro, verifyRootFromDb } from "@/middleware";
import { jwtServiceAdminService } from "./jwt.admin.service";

export const jwtServiceAdminApi = new Elysia({ prefix: "/admin/jwt-services" })
  .use(authMacro)
  .get(
    "/",
    async ({ identity }) => {
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
      response: jwtServiceListResponseSchema,
      detail: {
        summary: "List all JWT services",
        tags: ["Admin", "JWT Service"],
      },
    },
  )
  .get(
    "/:serviceKey",
    async ({ params, identity, set }) => {
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
      response: jwtServiceDTOSchema,
      detail: {
        summary: "Fetch a JWT service by serviceKey",
        tags: ["Admin", "JWT Service"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity, set }) => {
      if (identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Root role required");
      }
      const isRoot = await verifyRootFromDb(identity.unitId);
      if (!isRoot) return status(403, "Forbidden: Root role required");

      try {
        const service = await jwtServiceAdminService.create(body);
        set.status = 201;
        return service;
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "P2002"
        ) {
          set.status = 409;
          throw new Error(
            `JwtService with serviceKey '${body.serviceKey}' already exists`,
          );
        }
        throw error;
      }
    },
    {
      requireLogin: true,
      body: createJwtServiceInputSchema,
      response: jwtServiceDTOSchema,
      detail: {
        summary: "Create a JWT service",
        tags: ["Admin", "JWT Service"],
      },
    },
  )
  .patch(
    "/:serviceKey",
    async ({ params, body, identity, set }) => {
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
      try {
        return await jwtServiceAdminService.update(params.serviceKey, body);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "P2025"
        ) {
          set.status = 404;
          throw new Error(`JwtService not found: ${params.serviceKey}`);
        }
        throw error;
      }
    },
    {
      requireLogin: true,
      params: t.Object({ serviceKey: t.String() }),
      body: updateJwtServiceInputSchema,
      response: jwtServiceDTOSchema,
      detail: {
        summary: "Update a JWT service",
        tags: ["Admin", "JWT Service"],
      },
    },
  )
  .post(
    "/:serviceKey/activate",
    async ({ params, identity, set }) => {
      if (identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Root role required");
      }
      const isRoot = await verifyRootFromDb(identity.unitId);
      if (!isRoot) return status(403, "Forbidden: Root role required");

      try {
        return await jwtServiceAdminService.activate(params.serviceKey);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "P2025"
        ) {
          set.status = 404;
          throw new Error(`JwtService not found: ${params.serviceKey}`);
        }
        throw error;
      }
    },
    {
      requireLogin: true,
      params: t.Object({ serviceKey: t.String() }),
      response: jwtServiceDTOSchema,
      detail: {
        summary: "Activate a JWT service",
        tags: ["Admin", "JWT Service"],
      },
    },
  )
  .post(
    "/:serviceKey/deactivate",
    async ({ params, identity, set }) => {
      if (identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Root role required");
      }
      const isRoot = await verifyRootFromDb(identity.unitId);
      if (!isRoot) return status(403, "Forbidden: Root role required");

      try {
        return await jwtServiceAdminService.deactivate(params.serviceKey);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "P2025"
        ) {
          set.status = 404;
          throw new Error(`JwtService not found: ${params.serviceKey}`);
        }
        throw error;
      }
    },
    {
      requireLogin: true,
      params: t.Object({ serviceKey: t.String() }),
      response: jwtServiceDTOSchema,
      detail: {
        summary: "Deactivate a JWT service",
        tags: ["Admin", "JWT Service"],
      },
    },
  );
