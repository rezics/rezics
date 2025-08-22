import type { Book } from "contract";
import type { OptionalOrUndef } from "./common.ts";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
