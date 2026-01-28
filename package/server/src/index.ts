import {Elysia} from 'elysia';
import {swagger} from '@elysiajs/swagger';
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
import {cors} from '@elysiajs/cors';

import {getProdState} from './utils/getProdState';

import 'dotenv/config';

const {isProd, isDev} = getProdState();

if (isDev) {
  await import('./utils/logger-hook');
}

const devOrigins = ['http://localhost:35001', 'http://localhost:35002'];

const prodOrigins = ['https://book.rezics.com', 'https://rezics.com'];

const allowedOrigins = isDev ? devOrigins : prodOrigins;

const app = new Elysia()
  // CORS The policy may need to be updated
  .use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'X-Requested-With',
      ],
      exposeHeaders: ['Content-Type', 'Authorization'],
    }),
  )
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
  .get('/', () => 'Hello Elysia')
  .get('/health', () => ({status: 'ok'}));

if (isDev) {
  app.use(swagger());
}

app.listen(process.env.PORT ?? 3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Swagger UI: http://${app.server?.hostname}:${app.server?.port}/swagger`,
);
