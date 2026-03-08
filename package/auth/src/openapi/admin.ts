import {Elysia} from 'elysia';
import {
  listUsersResponseSchema,
  removeUserBodySchema,
  banUserBodySchema,
  unbanUserBodySchema,
  setRoleBodySchema,
} from '@package/contract';
import {handleAuthRequest} from '../auth/routes';
import {jsonRequestBody, jsonResponse} from './docs';

export const adminRouter = new Elysia()
  .get('/admin/list-users', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'List users',
      description: 'List all users with pagination. Requires admin privileges.',
      tags: ['Admin'],
      responses: {
        200: jsonResponse('Paginated user list.', listUsersResponseSchema),
      },
    },
  })
  .post('/admin/remove-user', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Remove user',
      description: 'Permanently remove a user account. Requires admin privileges.',
      tags: ['Admin'],
      requestBody: jsonRequestBody(removeUserBodySchema),
    },
  })
  .post('/admin/ban-user', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Ban user',
      description: 'Ban a user account. Requires admin privileges.',
      tags: ['Admin'],
      requestBody: jsonRequestBody(banUserBodySchema),
    },
  })
  .post('/admin/unban-user', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Unban user',
      description: 'Remove ban from a user account. Requires admin privileges.',
      tags: ['Admin'],
      requestBody: jsonRequestBody(unbanUserBodySchema),
    },
  })
  .post('/admin/set-role', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Set user role',
      description: 'Set the role for a user. Requires admin privileges.',
      tags: ['Admin'],
      requestBody: jsonRequestBody(setRoleBodySchema),
    },
  });
