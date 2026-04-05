import {Elysia} from 'elysia';
import {signInRouter} from './sign-in';
import {passwordRouter} from './password';
import {sessionRouter} from './session';
import {adminRouter} from './admin';
import {organizationRouter} from './organization';
import {oauthRouter} from './oauth';
import {selfServiceRouter} from './self-service';
import {jwtServiceAdminRouter} from '../jwt/jwt.admin.api';
import {handleAuthRequest} from '../auth/routes';
import {env} from '../env';
import {wellKnownApi} from '../well-known/well-known.api';

export const authOpenApiRouter = new Elysia({
  prefix: env.AUTH_OPENAPI_ROUTER_PREFIX,
})
  .use(signInRouter)
  .use(passwordRouter)
  .use(sessionRouter)
  .use(adminRouter)
  .use(organizationRouter)
  .use(oauthRouter)
  .use(selfServiceRouter)
  .use(jwtServiceAdminRouter)
  .use(
    new Elysia()
      .all('/*', ({request}) => handleAuthRequest(request), {
        detail: {
          summary: 'Catch All',
          description: 'Catch all route for all requests.',
          tags: ['Catch All'],
        },
      }),
  );
