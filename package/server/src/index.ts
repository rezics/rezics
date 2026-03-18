import {Elysia} from 'elysia';
import {openapi} from '@elysiajs/openapi';
import {bookApi} from './book';
import {chapterApi} from './chapter';
import {readlistApi} from './readlist';
import {reviewApi} from './review';
import {userApi} from './user';
import {meiliApi} from './meili';
import {unitApi} from './unit';
import {tagApi} from './tag';
import {echoKvApi} from './echokv';
import {commentApi} from './comment';
import {reactionApi} from './reaction';
import {tokenApi} from './token';
import {feedbackApi} from './feedback';
import {sessionApi} from './session';

import {getProdState} from './utils/getProdState';
import {env} from './env';

import 'dotenv/config';

const {isProd, isDev} = getProdState();

const app = new Elysia();

if (isDev) {
  await import('./utils/logger-hook');
  app.use(openapi()).trace(async ({onHandle, context}) => {
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
}

app
  .onError(({code, error, set}) => {
    set.status ||= 500;
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';

    return {
      status: set.status,
      code,
      message,
    };
  })
  .use(bookApi)
  .use(chapterApi)
  .use(readlistApi)
  .use(reviewApi)
  .use(userApi)
  .use(meiliApi)
  .use(unitApi)
  .use(tagApi)
  .use(commentApi)
  .use(reactionApi)
  .use(tokenApi)
  .use(echoKvApi)
  .use(feedbackApi)
  .use(sessionApi)
  .get('/', () => 'Hello Elysia')
  .get('/health', () => ({status: 'ok'}));

const port = env.PORT ? Number(env.PORT) : 3000;

app.listen(port);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Openapi UI: http://${app.server?.hostname}:${app.server?.port}/openapi`,
);
