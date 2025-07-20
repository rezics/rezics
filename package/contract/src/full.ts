import { initContract } from "@ts-rest/core";
import { authRouter } from "./module/Auth";
import { readlistRouter } from "./module/ReadList";
import { bookRouter } from "./module/Book";
import { reviewRouter } from "./module/Review";
import { tagRouter } from "./module/Tag";
import { postRouter } from "./module/Post";
import { commentRouter } from "./module/Comment";
import { homePageRouter } from "./module/HomePage";

const c = initContract();

export const contract = c.router({
    auth: authRouter,
    book: bookRouter,
    review: reviewRouter,
    tag: tagRouter,
    post: postRouter,
    readlist: readlistRouter,
    comment: commentRouter,
    home: homePageRouter,
});
