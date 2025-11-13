import {Elysia} from 'elysia';
import {swagger} from '@elysiajs/swagger';
import {bookApi} from './book';
import {chapterApi} from './chapter';
import {readlistApi} from './readlist';
import {reviewApi} from './review';
import {userApi} from './user';
import {unitApi} from './unit';
import {tagApi} from './tag';
import {echoKvApi} from './echokv';
import {commentApi} from './comment';
import {reactionApi} from './reaction';

import 'dotenv/config';

if (process.env.NODE_ENV === 'development') {
  await import('./utils/logger-hook');
}

const app = new Elysia()
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
  .use(swagger())
  .use(bookApi)
  .use(chapterApi)
  .use(readlistApi)
  .use(reviewApi)
  .use(userApi)
  .use(unitApi)
  .use(tagApi)
  .use(commentApi)
  .use(reactionApi)
  .use(echoKvApi)
  .get('/', () => 'Hello Elysia')
  .get('/health', () => ({status: 'ok'}))
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Swagger UI: http://${app.server?.hostname}:${app.server?.port}/swagger`,
);
