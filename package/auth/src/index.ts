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

const app = coreInstance();

if (isDev) {
  await import('./utils/logger-hook');
  app
    .use(openapi())
    .trace(async ({onHandle, context}) => {
      // 监听 handle 阶段
      onHandle(({begin, onStop}) => {
        const {route, params, request} = context;

        onStop(({end}) => {
          console.log(
            `[${request.method}] ${route} took ${end - begin}ms`,
            'params:',
            params,
          );
        });
      });
    })
    .onError(({code, error, set}) => {
      console.log('[Error] ', code, error, set);
    });
}

app
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

console.log('env.PORT', env.PORT);
const port = Number(env.PORT);
app.listen(port);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Openapi UI: http://${app.server?.hostname}:${app.server?.port}/openapi`,
);
