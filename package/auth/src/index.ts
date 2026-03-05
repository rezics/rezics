import {coreInstance} from './core';
import {
  handleAuthRequest,
  handleJwksCompatibilityRequest,
  handleOAuthAuthorizationServerRequest,
  handleOpenIdConfigRequest,
} from './auth/routes';
import {env} from './env';
import {swagger} from '@elysiajs/swagger';

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
  .all('/api/auth/*', ({request}) => handleAuthRequest(request))
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
  app.use(swagger());
}

const port = env.PORT ? Number(env.PORT) : 3001;
app.listen(port);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Swagger UI: http://${app.server?.hostname}:${app.server?.port}/swagger`,
);
