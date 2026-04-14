import type {
  OrgCreditDTO,
  OrganizationDTO,
  PersonCreditDTO,
  PersonDTO,
} from "@rezics/contract";
import {
  BasicAdminPermission,
  createOrganizationSchema,
  createPersonSchema,
  linkOrgCreditSchema,
  linkPersonCreditSchema,
  organizationListQuerySchema,
  organizationParamsSchema,
  personListQuerySchema,
  personParamsSchema,
  updateOrganizationSchema,
  updatePersonSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { attributionService } from "./attribution.service";

export const attributionApi = new Elysia({ prefix: "/attribution" })
  .use(authMacro)
  // --- Person routes ---
  .get(
    "/persons",
    async ({
      query,
    }): Promise<{ persons: PersonDTO[]; total: number }> => {
      return attributionService.listPersons(query as any);
    },
    {
      query: personListQuerySchema,
      detail: {
        summary: "List persons",
        description: "List persons with filtering and pagination",
        tags: ["Attribution"],
      },
    },
  )
  .get(
    "/persons/:id",
    async ({ params }): Promise<PersonDTO> => {
      return attributionService.getPersonById(params.id);
    },
    {
      params: personParamsSchema,
      detail: {
        summary: "Get person",
        description: "Get a single person by ID",
        tags: ["Attribution"],
      },
    },
  )
  .post(
    "/persons",
    async ({ body, identity, set }): Promise<PersonDTO> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      return attributionService.createPerson(body);
    },
    {
      requireLogin: true,
      body: createPersonSchema,
      detail: {
        summary: "Create person",
        description: "Create a new person (admin only)",
        tags: ["Attribution"],
      },
    },
  )
  .put(
    "/persons/:id",
    async ({ params, body, identity, set }): Promise<PersonDTO> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      return attributionService.updatePerson(params.id, body);
    },
    {
      requireLogin: true,
      params: personParamsSchema,
      body: updatePersonSchema,
      detail: {
        summary: "Update person",
        description: "Update a person (admin only)",
        tags: ["Attribution"],
      },
    },
  )
  .delete(
    "/persons/:id",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      await attributionService.deletePerson(params.id);
      return { message: "Person deleted successfully" };
    },
    {
      requireLogin: true,
      params: personParamsSchema,
      detail: {
        summary: "Delete person",
        description: "Delete a person (admin only)",
        tags: ["Attribution"],
      },
    },
  )
  // --- Organization routes ---
  .get(
    "/organizations",
    async ({
      query,
    }): Promise<{ organizations: OrganizationDTO[]; total: number }> => {
      return attributionService.listOrganizations(query as any);
    },
    {
      query: organizationListQuerySchema,
      detail: {
        summary: "List organizations",
        description: "List organizations with filtering and pagination",
        tags: ["Attribution"],
      },
    },
  )
  .get(
    "/organizations/:id",
    async ({ params }): Promise<OrganizationDTO> => {
      return attributionService.getOrganizationById(params.id);
    },
    {
      params: organizationParamsSchema,
      detail: {
        summary: "Get organization",
        description: "Get a single organization by ID",
        tags: ["Attribution"],
      },
    },
  )
  .post(
    "/organizations",
    async ({ body, identity, set }): Promise<OrganizationDTO> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      return attributionService.createOrganization(body);
    },
    {
      requireLogin: true,
      body: createOrganizationSchema,
      detail: {
        summary: "Create organization",
        description: "Create a new organization (admin only)",
        tags: ["Attribution"],
      },
    },
  )
  .put(
    "/organizations/:id",
    async ({
      params,
      body,
      identity,
      set,
    }): Promise<OrganizationDTO> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      return attributionService.updateOrganization(params.id, body);
    },
    {
      requireLogin: true,
      params: organizationParamsSchema,
      body: updateOrganizationSchema,
      detail: {
        summary: "Update organization",
        description: "Update an organization (admin only)",
        tags: ["Attribution"],
      },
    },
  )
  .delete(
    "/organizations/:id",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      await attributionService.deleteOrganization(params.id);
      return { message: "Organization deleted successfully" };
    },
    {
      requireLogin: true,
      params: organizationParamsSchema,
      detail: {
        summary: "Delete organization",
        description: "Delete an organization (admin only)",
        tags: ["Attribution"],
      },
    },
  )
  // --- Credit link routes ---
  .post(
    "/credits/person",
    async ({ body, identity, set }): Promise<PersonCreditDTO> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      return attributionService.linkPersonCredit(body);
    },
    {
      requireLogin: true,
      body: linkPersonCreditSchema,
      detail: {
        summary: "Link person credit to unit",
        description: "Link a person credit to a unit (admin only)",
        tags: ["Attribution"],
      },
    },
  )
  .delete(
    "/credits/person/:unitId/:personId/:roleKey",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      await attributionService.unlinkPersonCredit(
        params.unitId,
        params.personId,
        params.roleKey,
      );
      return { message: "Person credit unlinked" };
    },
    {
      requireLogin: true,
      params: t.Object({
        unitId: t.String(),
        personId: t.String(),
        roleKey: t.String(),
      }),
      detail: {
        summary: "Unlink person credit from unit",
        description: "Unlink a person credit from a unit (admin only)",
        tags: ["Attribution"],
      },
    },
  )
  .post(
    "/credits/organization",
    async ({ body, identity, set }): Promise<OrgCreditDTO> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      return attributionService.linkOrgCredit(body);
    },
    {
      requireLogin: true,
      body: linkOrgCreditSchema,
      detail: {
        summary: "Link organization credit to unit",
        description: "Link an organization credit to a unit (admin only)",
        tags: ["Attribution"],
      },
    },
  )
  .delete(
    "/credits/organization/:unitId/:organizationId/:roleKey",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      await attributionService.unlinkOrgCredit(
        params.unitId,
        params.organizationId,
        params.roleKey,
      );
      return { message: "Organization credit unlinked" };
    },
    {
      requireLogin: true,
      params: t.Object({
        unitId: t.String(),
        organizationId: t.String(),
        roleKey: t.String(),
      }),
      detail: {
        summary: "Unlink organization credit from unit",
        description:
          "Unlink an organization credit from a unit (admin only)",
        tags: ["Attribution"],
      },
    },
  );

export default attributionApi;
