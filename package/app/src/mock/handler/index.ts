import {authHttpHandlers} from './auth.ts';
import {bookHttpHandlers} from './book/httpHandlers.ts';
import {chapterHttpHandlers} from './chapter.ts';
import {commentHttpHandlers} from './comment/httpHandlers.ts';
import {readlistHttpHandlers} from './readlist/httpHandlers.ts';
import {reviewHttpHandlers} from './review/httpHandlers.ts';
import {tagHttpHandlers} from './tag/httpHandlers.ts';
import {userHttpHandlers} from './user/httpHandlers.ts';

export const apiHandlers = [
  ...authHttpHandlers,
  ...bookHttpHandlers,
  ...chapterHttpHandlers,
  ...tagHttpHandlers,
  ...readlistHttpHandlers,
  ...reviewHttpHandlers,
  ...userHttpHandlers,
  ...commentHttpHandlers,
];
