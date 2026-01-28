import {coreInstance} from '../core';

import {coreRoute} from './user.core.api';
import {adminRoute} from './user.admin.api';
import {followRoute} from './user.follow.api';
import {verifyRoute} from './user.verify.api';

/**
 * User Controller - Elysia.js routes with JWT authentication
 */
export const userApi = coreInstance('/users')
  .use(coreRoute)
  .use(adminRoute)
  .use(followRoute)
  .use(verifyRoute);
