import {coreInstance} from './core';
import {
  handleAuthRequest,
  handleJwksCompatibilityRequest,
  handleOAuthAuthorizationServerRequest,
  handleOpenIdConfigRequest,
} from './auth/routes';
import {env} from './env';

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

const port = env.PORT ? Number(env.PORT) : 35003;
app.listen(port);

console.log(
  `Auth service running at http://${app.server?.hostname}:${app.server?.port}`,
);
