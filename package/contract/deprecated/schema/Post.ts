import { z } from "zod";
import { Auditable, Evaluable, id, Nameable, Tagable } from "./common";

export namespace Post {
	const Mutable = {
		...Nameable.shape,
		...Tagable.shape,
		content: z.string(),
		authorId: id,
	};

	export const Create = z.object({
		...Mutable,
	});

	export const Read = z
		.object({
			id,

			authorId: id,
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
		})
		.partial();

	export const View = z.object({
		id,

		...Mutable,
		...Evaluable.shape,
		...Auditable.shape,
	});
}
