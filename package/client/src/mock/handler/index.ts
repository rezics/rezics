// import { authHandlers } from "./auth.ts";
// import { bookHandlers } from "./book.ts";
// import { reviewHandlers } from "./review.ts";
// import { readlistHandlers } from "./readlist.ts";
// import { tagHandlers } from "./tag.ts";
// import { postHandlers } from "./post.ts";
// import { homePageHandlers } from "./homePage.ts";
// import { commentHandlers } from "./comment.ts";

import { tagCreateHandler } from "./tag.ts";

import { http, HttpResponse } from "msw";

// 定义 operation -> handler 的映射
const operationMap: Record<
  string,
  (body: any, req: any, ctx: any) => Promise<any> | any
> = {
  "tag.create": tagCreateHandler,
  //   "tag.delete": tagDeleteHandler,
  //   "post.publish": postPublishHandler,
};

export const apiHandler = http.all("/api", async ({ request, params, cookies }) => {
  try {
    console.log("apiHandler", request, params, cookies);
    const body: any = await request.json();

    console.log("body", body);
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

    return HttpResponse.json(result, { status: 200 });
  } catch (err) {
    return HttpResponse.json(
      { error: "Internal mock server error", detail: String(err) },
      { status: 500 }
    );
  }
});
