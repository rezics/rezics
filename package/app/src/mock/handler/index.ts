import { authHandlers } from "./auth";
import { bookHandlers } from "./book";
import { bookInfoHandlers } from "./bookinfo";
import { bookListHandlers } from "./bookList";
import { bookQuoteExcerptHandlers } from "./bookQuoteExcerpt";
import { bookReviewsHandlers } from "./bookReviews";
import { homepageHandlers } from "./homepage";
import { chapterHandlers } from "./chapter";
import { postHandlers } from "./post";

export const handlers = [
    ...authHandlers,
    ...bookHandlers,
    ...bookInfoHandlers,
    ...bookListHandlers,
    ...bookQuoteExcerptHandlers,
    ...bookReviewsHandlers,
    ...homepageHandlers,
    ...chapterHandlers,
    ...postHandlers,
];
