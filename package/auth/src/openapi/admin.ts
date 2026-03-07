import {Elysia} from 'elysia';
import {
  listUsersResponseSchema,
  removeUserBodySchema,
  banUserBodySchema,
  unbanUserBodySchema,
  setRoleBodySchema,
} from '@package/contract';
import {handleAuthRequest} from '../auth/routes';

export const adminRouter = new Elysia()
  .get('/admin/list-users', ({request}) => handleAuthRequest(request), {
    response: listUsersResponseSchema,
    detail: {
      summary: 'List users',
      description: 'List all users with pagination. Requires admin privileges.',
      tags: ['Admin'],
    },
  })
  .post('/admin/remove-user', ({request}) => handleAuthRequest(request), {
    body: removeUserBodySchema,
    detail: {
      summary: 'Remove user',
      description: 'Permanently remove a user account. Requires admin privileges.',
      tags: ['Admin'],
    },
  })
  .post('/admin/ban-user', ({request}) => handleAuthRequest(request), {
    body: banUserBodySchema,
    detail: {
      summary: 'Ban user',
      description: 'Ban a user account. Requires admin privileges.',
      tags: ['Admin'],
    },
  })
  .post('/admin/unban-user', ({request}) => handleAuthRequest(request), {
    body: unbanUserBodySchema,
    detail: {
      summary: 'Unban user',
      description: 'Remove ban from a user account. Requires admin privileges.',
      tags: ['Admin'],
    },
  })
  .post('/admin/set-role', ({request}) => handleAuthRequest(request), {
    body: setRoleBodySchema,
    detail: {
      summary: 'Set user role',
      description: 'Set the role for a user. Requires admin privileges.',
      tags: ['Admin'],
    },
  });
