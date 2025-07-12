import { http, HttpResponse } from "msw";
import { mockBookLists } from "../data/booklists";
import { mockCommentTree01 } from "../data/comment01";
import { mockABookList01 } from "../data/abooklist01";

export const bookListHandlers = [
    // ANCHOR BOOKLIST
    // ANCHOR 🟢 REST: GET /booklists
    http.get("/booklists", () => {
        return HttpResponse.json(mockBookLists);
    }),

    // ANCHOR 🟢 REST: GET /booklists/:id
    http.get("/booklists/:id", ({ params }) => {
        const { id } = params;
        
        // Return the mock book list data
        return HttpResponse.json(mockABookList01);
    }),

    // ANCHOR 🟢 REST: GET /booklists/:bookListId/comments
    http.get("/booklists/:bookListId/comments", ({ params }) => {
        const { bookListId } = params;
        return HttpResponse.json(mockCommentTree01);
    }),

    // ANCHOR 🟢 REST: POST /booklists/:bookListId/comments
    http.post("/booklists/:bookListId/comments", async ({ request, params }) => {
        const { bookListId } = params;
        const body = await request.json();
        
        // Return a mock new comment
        return HttpResponse.json({
            id: `comment_${Date.now()}`,
            content: body.content,
            createdAt: new Date().toISOString(),
            user: {
                id: "user1",
                name: "John Doe",
                avatar: "https://via.placeholder.com/150",
            },
            likes: 0,
        });
    }),
];
