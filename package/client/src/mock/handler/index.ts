// import { authHandlers } from "./auth.ts";
// import { bookHandlers } from "./book.ts";
// import { reviewHandlers } from "./review.ts";
// import { readlistHandlers } from "./readlist.ts";
// import { tagHandlers } from "./tag.ts";
// import { postHandlers } from "./post.ts";
// import { homePageHandlers } from "./homePage.ts";
// import { commentHandlers } from "./comment.ts";

import { tagCreateHandler, tagReadHandler, tagUpdateHandler, tagDeleteHandler } from "./tag.ts";
import {
  bookCreateHandler,
  bookReadHandler,
  bookUpdateHandler,
  bookDeleteHandler,
  bookListHandler,
  chapterListHandler,
  chapterReadHandler,
} from "./book.ts";
import {
  commentCreateHandler,
  commentReadHandler,
  commentUpdateHandler,
  commentDeleteHandler,
  commentListByTargetHandler,
} from "./comment.ts";

import { http, HttpResponse } from "msw";
import { reviewShortListHandler, reviewCreateHandler, reviewListQuotesHandler } from "./review.ts";

// 定义 operation -> handler 的映射
const operationMap: Record<
  string,
  (body: any, req: any, ctx: any) => Promise<any> | any
> = {
  "tag.create": tagCreateHandler,
  "tag.read": tagReadHandler,
  "tag.update": tagUpdateHandler,
  "tag.delete": tagDeleteHandler,
  // Book
  "book.create": bookCreateHandler,
  "book.read": bookReadHandler,
  "book.update": bookUpdateHandler,
  "book.delete": bookDeleteHandler,
  "book.list": bookListHandler,
  // Chapter
  "chapter.list": chapterListHandler,
  "chapter.read": chapterReadHandler,
  // Comment
  "comment.create": commentCreateHandler,
  "comment.read": commentReadHandler,
  "comment.update": commentUpdateHandler,
  "comment.delete": commentDeleteHandler,
  // custom op for listing comments under an entity
  "comment.listByTarget": commentListByTargetHandler,
  //"post.publish": postPublishHandler,
  // Review
  "review.short.list": reviewShortListHandler,
  "review.create": reviewCreateHandler,
  "review.listQuotes": reviewListQuotesHandler,
};

export const apiHandler = http.all("/api", async ({ request, params, cookies }) => {
  try {
    console.log("apiHandler", request, params, cookies);
    const body: any = await request.json();

    // console.log("body", body);
    const operation = body.operation;

    if (!operation || typeof operation !== "string") {
      return HttpResponse.json({ error: "Missing operation" }, { status: 400 });
    }

    const handler = operationMap[operation];
    if (!handler) {
      return HttpResponse.json(
        { error: `No handler for operation "${operation}"` },
        { status: 404 }
      );
    }

    const result = handler(body, request, cookies);

    // return HttpResponse.json(result, { status: 200 });
    return result;
  } catch (err) {
    return HttpResponse.json(
      { error: "Internal mock server error", detail: String(err) },
      { status: 500 }
    );
  }
});
