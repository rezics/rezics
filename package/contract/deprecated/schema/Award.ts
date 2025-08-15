import { z } from "zod";
import { Auditable, id } from "./common";
import { User } from "./User";

export namespace Award {
	const Mutable = {
		objectType: z.string(), // e.g. "Comment", "Post", ...
		// is award record object type necessary
		objectId: id,
		type: z.string(), // 为了拓展性
		userId: id,
	};

	export const Create = z.object({
		...Mutable,
	});

	export const Read = z
		.object({
			id,

			objectType: z.string(),
			objectId: id,
			type: z.string(),
			userId: id,
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

		objectType: z.string(),
		objectId: id,
		type: z.string(),
		user: User.Preview,
		...Auditable.shape,
	});
}

export namespace AwardStats {
	export const Item = z.object({
		type: Award.Create.shape.type,
		count: z.number(),
	});

	export const View = z.array(Item);
}
