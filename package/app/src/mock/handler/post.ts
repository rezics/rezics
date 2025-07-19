import { http, HttpResponse } from "msw";
import { postRouter } from "../../../../contract/post";

const postList01 = [
    { id: "1", title: "Post 1", content: "Content 1" },
    { id: "2", title: "Post 2", content: "Content 2" },
];


export const postHandlers = [
    http.get(postRouter.list.path, () => {
        return HttpResponse.json({
            data: {
                posts: postList01,
            },
        });
    }),
    http.put(postRouter.update.path, () => {
        return HttpResponse.json({
            data: {
                post: postList01[0],
            },
        });
    }),
];