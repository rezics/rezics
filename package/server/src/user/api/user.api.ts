import {Elysia} from 'elysia';
import {serverCorsPolicy} from '@/src/middleware';

import {coreRoute} from './user.core.api';
import {adminRoute} from './user.admin.api';
import {followRoute} from './user.follow.api';

/**
 * User Controller - Elysia.js routes with JWT authentication
 */
export const userApi = new Elysia({prefix: '/users'})
  .use(serverCorsPolicy('credentialed'))
  .use(coreRoute)
  .use(adminRoute)
  .use(followRoute);
