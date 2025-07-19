import { initContract } from "@ts-rest/core";
import { authRouter } from "./module/auth";
import { readlistRouter } from "./module/readList";
import { bookRouter } from "./module/book";
import { reviewRouter } from "./module/review";
import { tagRouter } from "./module/tag";
import { postRouter } from "./module/post";

export * from "./module/auth";
export * from "./module/book";
export * from "./module/common";
export * from "./module/post";
export * from "./module/readList";
export * from "./module/review";
export * from "./module/tag";

export * as ts_rest from "@ts-rest/core";
export * as ts_fastify from "@ts-rest/fastify";
export * as ts_query from "@ts-rest/react-query/v5";

export * as react_query from "@tanstack/react-query";

const c = initContract();

export const contract = c.router({
  auth: authRouter,
  books: bookRouter,
  review: reviewRouter,
  tag: tagRouter,
  posts: postRouter,
  readlists: readlistRouter,
});

export type AppContract = typeof contract;  