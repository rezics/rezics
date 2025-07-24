import c from "./c";
import { z } from "zod";
import { PaginationQuerySchema, PaginatedResponse } from "./common";
import { Book } from "../schema/Book";

export default c.router({
    get: {
        method: "GET",
        path: "/book/:bookId",
        responses: { 200: Book.View, 404: z.object({ message: z.string() }) },
    },
    update: {
        method: "PUT",
        path: "/book/:id",
        body: Book.Create.partial().omit({ id: true }),
        responses: { 200: Book.View, 404: z.object({ message: z.string() }) },
    },
    list: {
        method: "GET",
        path: "/book/list",
        query: PaginationQuerySchema.extend({ q: z.string().optional() }),
        responses: { 200: PaginatedResponse(Book.View) },
    },
});
