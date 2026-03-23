import {Elysia, t} from 'elysia';
import {coreInstance} from '@/src/core';
import {serverCorsPolicy} from '@/src/cors';
import {
  sessionContextPlugin,
  requireAdminSession,
} from '@/src/auth/context';
import {
  jwtServiceDTOSchema,
  jwtServiceListResponseSchema,
  createJwtServiceInputSchema,
  updateJwtServiceInputSchema,
} from '@package/contract';
import {jwtServiceAdminService} from './jwt-service.service';

export const jwtServiceAdminApi = coreInstance('/admin/jwt-services').use(serverCorsPolicy('credentialed')).use(
  new Elysia()
    .use(sessionContextPlugin)
    .get(
      '/',
      async ({session, currentUser, set}) => {
        requireAdminSession({session, currentUser, set});
        const services = await jwtServiceAdminService.list();
        return {services};
      },
      {
        response: jwtServiceListResponseSchema,
        detail: {
          summary: 'List all JWT services',
          tags: ['Admin', 'JWT Service'],
        },
      },
    )
    .get(
      '/:serviceKey',
      async ({params, session, currentUser, set}) => {
        requireAdminSession({session, currentUser, set});
        const service = await jwtServiceAdminService.fetch(params.serviceKey);
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
          summary: 'Fetch a JWT service by serviceKey',
          tags: ['Admin', 'JWT Service'],
        },
      },
    )
    .post(
      '/',
      async ({body, session, currentUser, set}) => {
        requireAdminSession({session, currentUser, set});
        try {
          const service = await jwtServiceAdminService.create(body);
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
          summary: 'Create a JWT service',
          tags: ['Admin', 'JWT Service'],
        },
      },
    )
    .patch(
      '/:serviceKey',
      async ({params, body, session, currentUser, set}) => {
        requireAdminSession({session, currentUser, set});
        if (body.jwksUrl !== undefined) {
          try {
            new URL(body.jwksUrl);
          } catch {
            set.status = 422;
            throw new Error(`Invalid URL for jwksUrl: ${body.jwksUrl}`);
          }
        }
        try {
          return await jwtServiceAdminService.update(
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
            throw new Error(
              `JwtService not found: ${params.serviceKey}`,
            );
          }
          throw error;
        }
      },
      {
        params: t.Object({serviceKey: t.String()}),
        body: updateJwtServiceInputSchema,
        response: jwtServiceDTOSchema,
        detail: {
          summary: 'Update a JWT service',
          tags: ['Admin', 'JWT Service'],
        },
      },
    )
    .post(
      '/:serviceKey/activate',
      async ({params, session, currentUser, set}) => {
        requireAdminSession({session, currentUser, set});
        try {
          return await jwtServiceAdminService.activate(params.serviceKey);
        } catch (error) {
          if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            (error as {code: string}).code === 'P2025'
          ) {
            set.status = 404;
            throw new Error(
              `JwtService not found: ${params.serviceKey}`,
            );
          }
          throw error;
        }
      },
      {
        params: t.Object({serviceKey: t.String()}),
        response: jwtServiceDTOSchema,
        detail: {
          summary: 'Activate a JWT service',
          tags: ['Admin', 'JWT Service'],
        },
      },
    )
    .post(
      '/:serviceKey/deactivate',
      async ({params, session, currentUser, set}) => {
        requireAdminSession({session, currentUser, set});
        try {
          return await jwtServiceAdminService.deactivate(params.serviceKey);
        } catch (error) {
          if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            (error as {code: string}).code === 'P2025'
          ) {
            set.status = 404;
            throw new Error(
              `JwtService not found: ${params.serviceKey}`,
            );
          }
          throw error;
        }
      },
      {
        params: t.Object({serviceKey: t.String()}),
        response: jwtServiceDTOSchema,
        detail: {
          summary: 'Deactivate a JWT service',
          tags: ['Admin', 'JWT Service'],
        },
      },
    ),
);
