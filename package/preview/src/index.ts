import {Elysia} from 'elysia';
import {swagger} from '@elysiajs/swagger';
import {bookApi} from './book/book.api';
import {prisma} from '@package/server';
import {envConfig} from './config';
import {getProdState} from './utils/getProdState';

const {isProd, isDev} = getProdState();

if (isDev) {
  await import('./utils/logger-hook');
}

const app = new Elysia()
  .use(swagger())
  .decorate('prisma', prisma)
  .use(bookApi)
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
  });

const server = app.listen(envConfig.SERVER_PORT);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Swagger UI: http://${app.server?.hostname}:${app.server?.port}/swagger`,
);
