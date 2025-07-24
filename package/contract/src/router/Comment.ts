import c from "./c";
import { PaginationQuerySchema, PaginatedResponse } from "./common";
import { CommentSchema } from "../schema/Comment";

export default c.router({
    list: {
        method: "GET",
        path: "/comment/list/:commentId",
        query: PaginationQuerySchema,
        responses: { 200: PaginatedResponse(CommentSchema) },
    },
});
