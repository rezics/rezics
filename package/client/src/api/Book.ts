import { Book } from "contract";
import { OptionalOrUndef } from "./common.ts";

const createBookInput = {
    operation: "book.read",
    parameter: { id: "undefined" },
    select: {
        id: true,
        name: true,
        authors: [{ id: true, name: true, description: true }], // TODO contract need to add avatar
        cover: true,
        description: true,
        length: true,
        publishers: [{ id: true, name: true }],
    },
} satisfies Book.Input.Read;

export type BookRead = Book.Output.Read<typeof createBookInput.select>;

export type BookReadPartial = OptionalOrUndef<BookRead>;
