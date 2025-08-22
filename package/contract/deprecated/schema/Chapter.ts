import { z } from "zod";
import { Auditable, Evaluable, id, Nameable, Tagable } from "./common";

export namespace Chapter {
	const Mutable = {
		...Nameable.shape,
		...Tagable.shape,
		bookId: id,
		content: z.string(),
	};

	export const Create = z.object({
		...Mutable,
	});

	export const Read = z
		.object({
			id,

			bookId: id,
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
		...Mutable,
		...Evaluable.shape,
		...Auditable.shape,
		id,
	});
}

export const ChapterOrder = z.map(id, z.array(id));

export type ChapterOrder = z.infer<typeof ChapterOrder>;
