import { http, HttpResponse } from "msw";
import { commentRouter } from "contract/module/comment";
import { mockCommentTree01 } from "../data/comment01";

export const commentHandlers = [
    http.get(commentRouter.list.path, ({ params }) => {
        return HttpResponse.json(mockCommentTree01);
    }),
];