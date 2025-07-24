import c from "./c";
import { PaginationQuerySchema, PaginatedResponse } from "./common";
import { ReadListSchema } from "../schema/ReadList";

export default c.router({
    get: {
        method: "GET",
        path: "/readlist/:readlistId",
        responses: { 200: ReadListSchema },
    },
    create: {
        method: "POST",
        path: "/readlist",
        body: ReadListSchema.omit({
            id: true,
            creator: true,
            commentsNumber: true,
        }),
        responses: { 201: ReadListSchema },
    },
    listByBook: {
        method: "GET",
        path: "/readlist/book/:bookId",
        query: PaginationQuerySchema,
        responses: { 200: PaginatedResponse(ReadListSchema) },
    },
});
