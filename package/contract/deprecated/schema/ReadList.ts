import { z } from "zod";
import { Book } from "./Book";
import { Auditable, Evaluable, icsId, id, Nameable } from "./common";
import { User } from "./User";

export namespace ReadList {
	const Mutable = {
		...Nameable.shape,
		description: z.string().nullable(),
		books: z.array(id),
		creatorId: id,
	};

	export const Create = z.object({
		...Mutable,
	});

	export const Read = z
		.object({
			id,
			icsId,
			creatorId: id,
		})
		.partial();

	export const Update = z
		.object({
			...Create.shape,
		})
		.partial();

	export const Delete = z
		.object({
			id,
			icsId,
		})
		.partial();

	export const View = z.object({
		id,
		icsId,
		...Nameable.shape,
		description: z.string().nullable(),
		books: z.array(Book.View),
		creator: User.Preview,
		...Evaluable.shape,
		...Auditable.shape,
	});
}
