import {Elysia} from 'elysia';
import {swagger} from '@elysiajs/swagger';
import {bookApi} from './book/book.api';
import {env} from './env';
import {getProdState} from './utils/getProdState';

const {isProd, isDev} = getProdState();

if (isDev) {
  await import('./utils/logger-hook');
}

const app = new Elysia()
  // .decorate('prisma', prisma)
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
  .use(bookApi);

if (isDev) {
  app.use(swagger());
}

app.listen(env.SERVER_PORT);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Swagger UI: http://${app.server?.hostname}:${app.server?.port}/swagger`,
);
