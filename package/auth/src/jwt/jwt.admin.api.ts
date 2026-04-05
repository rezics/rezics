import {Elysia, t} from 'elysia';
import {
  jwtServiceDTOSchema,
  jwtServiceListResponseSchema,
  createJwtServiceInputSchema,
  updateJwtServiceInputSchema,
} from '@rezics/contract';
import {auth} from '../auth/instance';
import {authJwtServiceAdminService} from './jwt.admin.service';

async function requireOwnerSession(request: Request) {
  const session = await auth.api.getSession({headers: request.headers});
  if (!session) {
    throw new Response('Unauthorized', {status: 401});
  }
  if ((session.user as {role?: string}).role !== 'owner') {
    throw new Response('Forbidden', {status: 403});
  }
  return session;
}

export const jwtServiceAdminRouter = new Elysia({
  prefix: '/admin/jwt-services',
})
  .get(
    '/',
    async ({request}) => {
      await requireOwnerSession(request);
      const services = await authJwtServiceAdminService.list();
      return {services};
    },
    {
      response: jwtServiceListResponseSchema,
      detail: {
        summary: 'List all auth JWT services',
        tags: ['Admin', 'JWT Service'],
      },
    },
  )
  .get(
    '/:serviceKey',
    async ({request, params, set}) => {
      await requireOwnerSession(request);
      const service = await authJwtServiceAdminService.fetch(params.serviceKey);
      if (!service) {
        set.status = 404;
        throw new Error(`JwtService not found: ${params.serviceKey}`);
      }
      return service;
    },
    {
      params: t.Object({serviceKey: t.String()}),
      response: jwtServiceDTOSchema,
      detail: {
        summary: 'Fetch an auth JWT service by serviceKey',
        tags: ['Admin', 'JWT Service'],
      },
    },
  )
  .post(
    '/',
    async ({request, body, set}) => {
      await requireOwnerSession(request);
      try {
        const service = await authJwtServiceAdminService.create(body);
        set.status = 201;
        return service;
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as {code: string}).code === 'P2002'
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
      body: createJwtServiceInputSchema,
      response: jwtServiceDTOSchema,
      detail: {
        summary: 'Create an auth JWT service',
        tags: ['Admin', 'JWT Service'],
      },
    },
  )
  .patch(
    '/:serviceKey',
    async ({request, params, body, set}) => {
      await requireOwnerSession(request);
      if (body.jwksUrl !== undefined) {
        try {
          new URL(body.jwksUrl);
        } catch {
          set.status = 422;
          throw new Error(`Invalid URL for jwksUrl: ${body.jwksUrl}`);
        }
      }
      try {
        return await authJwtServiceAdminService.update(
          params.serviceKey,
          body,
        );
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as {code: string}).code === 'P2025'
        ) {
          set.status = 404;
          throw new Error(`JwtService not found: ${params.serviceKey}`);
        }
        throw error;
      }
    },
    {
      params: t.Object({serviceKey: t.String()}),
      body: updateJwtServiceInputSchema,
      response: jwtServiceDTOSchema,
      detail: {
        summary: 'Update an auth JWT service',
        tags: ['Admin', 'JWT Service'],
      },
    },
  )
  .post(
    '/:serviceKey/activate',
    async ({request, params, set}) => {
      await requireOwnerSession(request);
      try {
        return await authJwtServiceAdminService.activate(params.serviceKey);
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as {code: string}).code === 'P2025'
        ) {
          set.status = 404;
          throw new Error(`JwtService not found: ${params.serviceKey}`);
        }
        throw error;
      }
    },
    {
      params: t.Object({serviceKey: t.String()}),
      response: jwtServiceDTOSchema,
      detail: {
        summary: 'Activate an auth JWT service',
        tags: ['Admin', 'JWT Service'],
      },
    },
  )
  .post(
    '/:serviceKey/deactivate',
    async ({request, params, set}) => {
      await requireOwnerSession(request);
      try {
        return await authJwtServiceAdminService.deactivate(params.serviceKey);
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as {code: string}).code === 'P2025'
        ) {
          set.status = 404;
          throw new Error(`JwtService not found: ${params.serviceKey}`);
        }
        throw error;
      }
    },
    {
      params: t.Object({serviceKey: t.String()}),
      response: jwtServiceDTOSchema,
      detail: {
        summary: 'Deactivate an auth JWT service',
        tags: ['Admin', 'JWT Service'],
      },
    },
  );
