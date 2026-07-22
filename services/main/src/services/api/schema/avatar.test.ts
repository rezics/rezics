import { describe, expect, it } from "vitest";
import Elysia from "elysia";

import { AvatarInput } from ".";
import { AvatarResponse } from "./response";

function avatarValidationApp() {
	return new Elysia().post(
		"/avatar",
		({ body }) =>
			body.type === "image"
				? { type: "image" as const, image: { id: body.image.assetId, url: "/image" } }
				: body,
		{
			body: AvatarInput,
			response: AvatarResponse,
		},
	);
}

async function submitAvatar(body: unknown): Promise<Response> {
	return avatarValidationApp().handle(
		new Request("http://localhost/avatar", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);
}

describe("AvatarInput", () => {
	it.each([
		{ type: "emoji", emoji: "👨‍👩‍👧‍👦" },
		{
			type: "icon",
			icon: { provider: "font-awesome", prefix: "fab", name: "500px" },
		},
	])("accepts a valid $type avatar", async (avatar) => {
		const response = await submitAvatar(avatar);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(avatar);
	});

	it.each([
		{ type: "emoji", emoji: "🦈🦈" },
		{
			type: "icon",
			icon: { provider: "font-awesome", prefix: "fad", name: "user" },
		},
	])("rejects an invalid $type avatar", async (avatar) => {
		const response = await submitAvatar(avatar);

		expect(response.status).toBe(422);
	});

	it("does not pass unknown icon fields to application code", async () => {
		const response = await submitAvatar({
			type: "icon",
			icon: { provider: "font-awesome", prefix: "fas", name: "user", extra: true },
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			type: "icon",
			icon: { provider: "font-awesome", prefix: "fas", name: "user" },
		});
	});
});
