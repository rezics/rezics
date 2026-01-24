import {coreInstance} from '../core';

import {coreRoute} from './user.core.api';
import {followRoute} from './user.follow.api';
import {verifyRoute} from './user.verify.api';

/**
 * User Controller - Elysia.js routes with JWT authentication
 */
export const userApi = coreInstance('/users')
  .use(coreRoute)
  .use(followRoute)
  .use(verifyRoute);
