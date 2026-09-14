import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	allocateAccessScope,
	allocateAccessSubject,
	resolveAccessScope,
	resolveAccessSubject,
} from "./identities";

const id = "018f2daa-62d9-7b41-8d20-29d221e63f52";
const noDatabase = new Proxy(
	{},
	{
		get() {
			throw new Error("Invalid input reached the database");
		},
	},
);

describe("private access identity input boundaries", () => {
	it.each([
		{ kind: "group", id },
		{ kind: "principal", id: "not-an-identity" },
		{ kind: "principal", id, entityId: id },
		{ kind: "entity", id, authUserId: id },
		{ kind: "entity" },
	])("rejects malformed or mixed subjects before lookup", async (input) => {
		await expect(
			Reflect.apply(allocateAccessSubject, undefined, [noDatabase, input]),
		).rejects.toBeInstanceOf(z.ZodError);
	});

	it.each([
		{ kind: "platform", id },
		{ kind: "realm", id },
		{ kind: "entity", id },
		{ kind: "account", id, referenceValueId: id },
		{ kind: "resource", id },
		{ kind: "resource", referenceValueId: "invalid" },
		{ kind: "resource", referenceValueId: id, owner: "entity" },
	])("rejects ambiguous scope aliases and untyped references before lookup", async (input) => {
		await expect(
			Reflect.apply(allocateAccessScope, undefined, [noDatabase, input]),
		).rejects.toBeInstanceOf(z.ZodError);
	});

	it("rejects invalid value keys before resolution", async () => {
		for (const resolve of [resolveAccessScope, resolveAccessSubject]) {
			await expect(
				Reflect.apply(resolve, undefined, [noDatabase, "invalid"]),
			).rejects.toBeInstanceOf(z.ZodError);
		}
	});
});
