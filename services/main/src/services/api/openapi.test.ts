import Elysia, { t } from "elysia";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { JsonValue } from "@rezics/portable-text";

import { toRezicsOpenApiSchema } from "./openapi";

describe("OpenAPI composition", () => {
	it("keeps named union variants separate for provider-specific enum generation", () => {
		const first = z.strictObject({ source: z.literal("first"), objectType: z.enum(["a", "b"]) }).meta({ $id: "FirstIntake" });
		const second = z.strictObject({ source: z.literal("second"), objectType: z.enum(["c", "d"]) }).meta({ $id: "SecondIntake" });
		const app = new Elysia().model({ FirstIntake: first, SecondIntake: second }).post("/intake",
			{ body: z.discriminatedUnion("source", [first, second]) }, ({ body }) => body);
		const document = toRezicsOpenApiSchema(app);
		expect(document.paths["/intake"]?.post?.requestBody).toMatchObject({ content: { "application/json": { schema: {
			oneOf: [{ $ref: "#/components/schemas/FirstIntake" }, { $ref: "#/components/schemas/SecondIntake" }],
		} } } });
		expect(document.components.schemas.FirstIntake).toMatchObject({ properties: { objectType: { enum: ["a", "b"] } } });
		expect(document.components.schemas.SecondIntake).toMatchObject({ properties: { objectType: { enum: ["c", "d"] } } });
	});
	it("collects schema-bearing routes across multiple used child applications", () => {
		const users = new Elysia({ prefix: "/users" }).get(
			"/:userId",
			{
				params: t.Object({ userId: t.String() }),
				response: t.Object({ userId: t.String() }),
			},
			({ params }) => params,
		);
		const notes = new Elysia({ prefix: "/notes" }).post(
			"/",
			{
				body: t.Object({ title: t.String() }),
				response: t.Object({ title: t.String() }),
			},
			({ body }) => body,
		);
		const application = new Elysia().use(users).use(notes);

		const document = toRezicsOpenApiSchema(application);

		expect(document.paths["/users/{userId}"]?.get).toBeDefined();
		expect(document.paths["/notes/"]?.post).toBeDefined();
	});

	it("retains named recursive components without exposing TypeBox metadata", () => {
		const application = new Elysia().post(
			"/payload",
			{
				body: t.Object({ value: JsonValue }),
				response: { 200: t.Any() },
			},
			() => null,
		);

		const document = toRezicsOpenApiSchema(application);
		const operation = document.paths["/payload"]?.post;

		expect(document.components.schemas.JsonValue).toBeDefined();
		expect(operation?.requestBody).toMatchObject({
			content: {
				"application/json": {
					schema: {
						properties: { value: { $ref: "#/components/schemas/JsonValue" } },
					},
				},
			},
		});
		expect(operation?.responses?.[200]).toMatchObject({
			content: { "application/json": { schema: {} } },
		});
		expect(JSON.stringify(document)).not.toContain('"~elyTyp"');
	});

	it("represents an empty tuple as an empty array for OpenAPI clients", () => {
		const application = new Elysia().get(
			"/empty",
			{ response: t.Object({ items: t.Tuple([]) }) },
			() => ({ items: [] as [] }),
		);

		const document = toRezicsOpenApiSchema(application);
		const response = document.paths["/empty"]?.get?.responses?.[200];

		expect(response).toMatchObject({
			content: {
				"application/json": {
					schema: {
						properties: {
							items: { type: "array", minItems: 0, maxItems: 0 },
						},
					},
				},
			},
		});
		expect(JSON.stringify(response)).not.toContain('"items":[]');
	});
});
