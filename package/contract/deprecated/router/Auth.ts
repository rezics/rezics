import { z } from "zod";
import { User } from "../schema/User";
import c from "./c";

export default c.router({
	login: {
		method: "POST",
		path: "/auth/login",
		body: z.object({ email: z.email(), password: z.string() }),
		responses: {
			200: z.object({ token: z.string(), user: User.View }),
			401: z.object({ message: z.string() }),
		},
	},
	register: {
		method: "POST",
		path: "/auth/register",
		body: z.object({ email: z.email(), password: z.string() }),
		responses: {
			200: z.object({ token: z.string(), user: User.View }),
		},
	},
	refresh: {
		method: "POST",
		path: "/auth/refresh",
		body: z.object({ refreshToken: z.string() }),
		responses: {
			200: z.object({
				accessToken: z.string(),
				refreshToken: z.string().optional(),
			}),
			401: z.object({ message: z.string() }),
		},
	},
});
