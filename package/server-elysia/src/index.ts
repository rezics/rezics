import {Elysia} from 'elysia';
import {swagger} from '@elysiajs/swagger';
import {bookApi} from './book';
import {userApi} from './user';

import 'dotenv/config';

if (process.env.NODE_ENV === 'development') {
  await import('./utils/logger-hook');
}

const app = new Elysia()
  .trace(async ({onHandle, context}) => {
    // 监听 handle 阶段
    onHandle(({begin, onStop}) => {
      const {path, params, request} = context;

      onStop(({end}) => {
        console.log(
          `[${request.method}] ${path} took ${end - begin}ms`,
          'params:',
          params,
        );
      });
    });
  })
  .use(swagger())
  .use(bookApi)
  .use(userApi)
  .get('/', () => 'Hello Elysia')
  .get('/health', () => ({status: 'ok'}))
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Swagger UI: http://${app.server?.hostname}:${app.server?.port}/swagger`,
);
