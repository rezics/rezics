import { authHandlers } from "./auth";
import { bookHandlers } from "./book";
import { reviewHandlers } from "./review";
import { readlistHandlers } from "./readlist";
import { tagHandlers } from "./tag";
import { postHandlers } from "./post";
import { homePageHandlers } from "./homePage";

export const handlers = [
    ...authHandlers,
    ...bookHandlers,
    ...reviewHandlers,
    ...readlistHandlers,
    ...tagHandlers,
    ...postHandlers,
    ...homePageHandlers,
]; 