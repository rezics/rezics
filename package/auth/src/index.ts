import {coreInstance} from './core';
import {authOpenApiRouter} from './openapi';
import {wellKnownApi} from './well-known/well-known.api';
import {env} from './env';
import {openapi} from '@elysiajs/openapi';
import {applyCorsToSet} from '@rezics/cors';
import {authConfigs} from './cors';

const isDev = env.NODE_ENV === 'development';

const app = coreInstance();

if (isDev) {
  await import('./utils/logger-hook');
  app
    .use(openapi({exclude: {staticFile: false}}))
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
  .onError(({error, request, set}) => {
    if (!set.headers['access-control-allow-origin']) {
      applyCorsToSet(request, set.headers, authConfigs['credentialed']);
    }

    if (!set.status) {
      set.status = 500;
    }

    return {
      error: error instanceof Error ? error.message : 'Internal Server Error',
    };
  })
  .use(wellKnownApi)
  .use(authOpenApiRouter)
  .get('/health', () => ({status: 'ok'}));

console.log('env.PORT', env.PORT);
const port = Number(env.PORT);
app.listen(port);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Openapi UI: http://${app.server?.hostname}:${app.server?.port}/openapi`,
);
