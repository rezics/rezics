// user.ts
import { z } from "zod";
import {
	Auditable,
	email,
	id,
	Nameable,
	password,
	phoneNumber,
	username,
} from "./common";

export namespace User {
	const Mutable = {
		username,
		email,
		phone: phoneNumber.nullable(),
		...Nameable.shape,
		avatar: z.url().nullable(),
		password,
	};

	export const Create = z.object({
		...Mutable,
	});

	export const Read = z
		.object({
			id,
			username,
			...Nameable.shape,
		})
		.partial();

	export const Update = z
		.object({
			...Mutable,
		})
		.partial();

	export const Delete = z
		.object({
			id,
		})
		.partial();

	export const View = z.object({
		id,
		username,
		email,
		phone: phoneNumber.nullable(),
		...Nameable.shape,
		avatar: z.url().nullable(),
		...Auditable.shape,
	});

	export const Preview = z.object({
		id,
		username,
		avatar: z.url().nullable(),
	});

	export const Signup = z.object({
		username,
		email,
		password,
		phone: phoneNumber.nullable(),
	});

	export const Login = z
		.object({
			username: z.string().optional(),
			email: z.string().optional(),
			password,
		})
		.refine((data) => data.username || data.email, {
			message: "Must provide username or email",
		});
}
