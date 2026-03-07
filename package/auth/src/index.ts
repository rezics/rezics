import {coreInstance} from './core';
import {
  handleJwksCompatibilityRequest,
  handleOAuthAuthorizationServerRequest,
  handleOpenIdConfigRequest,
} from './auth/routes';
import {authOpenApiRouter} from './openapi';
import {env} from './env';
import {openapi} from '@elysiajs/openapi';

const isDev = env.NODE_ENV === 'development';

const app = coreInstance()
  .onError(({error, set}) => {
    if (!set.status) {
      set.status = 500;
    }

    return {
      error: error instanceof Error ? error.message : 'Internal Server Error',
    };
  })
  .use(authOpenApiRouter)
  .get('/.well-known/jwks.json', ({request}) =>
    handleJwksCompatibilityRequest(request),
  )
  .get('/.well-known/openid-configuration', ({request}) =>
    handleOpenIdConfigRequest(request),
  )
  .get('/.well-known/oauth-authorization-server', ({request}) =>
    handleOAuthAuthorizationServerRequest(request),
  )
  .get('/health', () => ({status: 'ok'}));

if (isDev) {
  app.use(openapi());
}

const port = env.PORT ? Number(env.PORT) : 3001;
app.listen(port);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Openapi UI: http://${app.server?.hostname}:${app.server?.port}/openapi`,
);
