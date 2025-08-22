import {
	array,
	base64,
	boolean,
	iso,
	number,
	object,
	string,
	toJSONSchema,
	url,
	z,
	ZodType,
} from "zod/v4";

export type Unit = {
	title: string;
	children?: Unit[] | undefined;
};

export const Unit = (): ZodType<Unit> =>
	object({
		title: string(),
		children: array(Unit()).optional(),
	});

export const Book = object({
	id: object({
		isbn: string().length(13).optional(),
		icsid: string().optional(),
	}),
	cover: base64(),
	title: string(),
	authors: array(string().min(1)),
	units: array(Unit()),
	platform: string(),
	link: url(),
	tags: array(string()),
	description: string(),
	release: iso.datetime().nullable(),
	completed: boolean(),
	length: number(),
	last_update: iso.datetime(),
	rating: number().min(0).max(1).nullable(),
});

export type Book = z.infer<typeof Book>;

export default () =>
	JSON.stringify(toJSONSchema(Book, { target: "draft-7" }), null, 4);
