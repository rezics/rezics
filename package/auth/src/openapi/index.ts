import {Elysia} from 'elysia';
import {signInRouter} from './sign-in';
import {sessionRouter} from './session';
import {adminRouter} from './admin';
import {organizationRouter} from './organization';
import {oauthRouter} from './oauth';
import {handleAuthRequest} from '../auth/routes';

export const authOpenApiRouter = new Elysia({prefix: '/api/auth'})
  .use(signInRouter)
  .use(sessionRouter)
  .use(adminRouter)
  .use(organizationRouter)
  .use(oauthRouter)
  .all('/*', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Catch All',
      description: 'Catch all route for all requests.',
      tags: ['Catch All'],
    },
  });
