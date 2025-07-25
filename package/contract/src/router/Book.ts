import c from "./c";
import { z } from "zod";
import { Pagination } from "../schema/common";
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
        query: Pagination(Book.Read, Book.View).Read,
        responses: { 200: Pagination(Book.Read, Book.View).View },
    },
});
