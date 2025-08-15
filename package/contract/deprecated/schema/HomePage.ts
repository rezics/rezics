import { z } from "zod";
import { Auditable, id } from "./common";

export namespace HomePage {
	const Mutable = {
		content: z.string(),
	};

	export const Create = z.object({
		...Mutable,
	});

	export const Read = z
		.object({
			id,
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
		...Auditable.shape,
	});
}
