import {coreInstance} from '@/src/core';
import {withCredentialedCors} from '@/src/cors';

import {coreRoute} from './user.core.api';
import {adminRoute} from './user.admin.api';
import {followRoute} from './user.follow.api';

/**
 * User Controller - Elysia.js routes with JWT authentication
 */
export const userApi = withCredentialedCors(coreInstance('/users'))
  .use(coreRoute)
  .use(adminRoute)
  .use(followRoute);
