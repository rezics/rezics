import {coreInstance} from '../core';

import {coreRoute} from './user.core.api';
import {adminRoute} from './user.admin.api';
import {followRoute} from './user.follow.api';
import {verifyRoute} from './user.verify.api';

/**
 * User Controller - Elysia.js routes with JWT authentication
 */
export const userApi = coreInstance('/users')
  .onBeforeHandle(({request, set}) => {
    const {pathname} = new URL(request.url);
    const method = request.method.toUpperCase();

    const blockedLegacyIssueRoutes =
      (pathname === '/users/register' && method === 'POST') ||
      (pathname === '/users/login' && method === 'POST') ||
      (pathname === '/users/refresh-token' && method === 'POST');

    if (!blockedLegacyIssueRoutes) {
      return;
    }

    set.status = 410;
    return {
      error: 'Auth token issuance moved to package/auth (/api/auth).',
    };
  })
  .use(coreRoute)
  .use(adminRoute)
  .use(followRoute)
  .use(verifyRoute);
