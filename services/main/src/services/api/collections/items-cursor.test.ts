import { describe, expect, it } from "vitest";
import { InvalidPaginationCursor } from "../../pagination/errors";
import {
	decodeCollectionItemsCursor,
	encodeCollectionItemsCursor,
	type CollectionItemsCursorScope,
} from "./items-cursor";
const scope: CollectionItemsCursorScope = {
	collectionId: "019b0000-0000-7000-8000-000000000001",
	revisionId: "019b0000-0000-7000-8000-000000000002",
	authorization: { profileId: undefined },
	localizationLanguages: ["en"],
};
const boundary = { position: "a0", targetId: "019b0000-0000-7000-8000-000000000003" };
describe("confidential Collection continuation", () => {
	it("round-trips a hidden membership boundary without exposing its native ID", () => {
		const token = encodeCollectionItemsCursor(boundary, scope);
		expect(decodeCollectionItemsCursor(token, scope)).toEqual(boundary);
		expect(Buffer.from(token.split(".")[1]!, "base64url").toString()).not.toContain(
			boundary.targetId,
		);
		expect(encodeCollectionItemsCursor(boundary, scope)).not.toBe(token);
	});
	it("rejects changes to the salt, nonce, ciphertext or authentication tag", () => {
		const token = encodeCollectionItemsCursor(boundary, scope),
			bytes = Buffer.from(token.split(".")[1]!, "base64url");
		for (const offset of [0, 16, 28, bytes.length - 1]) {
			const changed = Buffer.from(bytes);
			changed[offset] = changed[offset]! ^ 1;
			expect(() =>
				decodeCollectionItemsCursor(`ci2.${changed.toString("base64url")}`, scope),
			).toThrow(InvalidPaginationCursor);
		}
	});
	it("binds Collection, revision, viewer and ordered languages", () => {
		const token = encodeCollectionItemsCursor(boundary, scope);
		for (const changed of [
			{ ...scope, collectionId: boundary.targetId },
			{ ...scope, revisionId: boundary.targetId },
			{ ...scope, authorization: { profileId: boundary.targetId, authUserId: boundary.targetId } },
			{ ...scope, localizationLanguages: ["fr" as const] },
		])
			expect(() => decodeCollectionItemsCursor(token, changed)).toThrow(InvalidPaginationCursor);
	});
	it("binds the current Self epoch and selected native grant", () => {
		const authority = {
			principal: { kind: "auth" as const, authUserId: scope.collectionId },
			actingEntityId: boundary.targetId,
			authorizationRevision: 1,
			grant: { id: scope.revisionId, revision: 1 },
		};
		const selected = {
			...scope,
			authorization: {
				profileId: boundary.targetId,
				authUserId: scope.collectionId,
				participationAuthority: authority,
			},
		};
		const token = encodeCollectionItemsCursor(boundary, selected);
		expect(decodeCollectionItemsCursor(token, selected)).toEqual(boundary);
		for (const participationAuthority of [
			{ ...authority, authorizationRevision: 2 },
			{ ...authority, actingEntityId: scope.collectionId },
			{ ...authority, grant: { ...authority.grant, revision: 2 } },
		])
			expect(() =>
				decodeCollectionItemsCursor(token, {
					...selected,
					authorization: { ...selected.authorization, participationAuthority },
				}),
			).toThrow(InvalidPaginationCursor);
	});
	it("supports a maximum stored fractional position within the existing transport ceiling", () => {
		const value = { ...boundary, position: `a0${"0".repeat(1021)}1` };
		const token = encodeCollectionItemsCursor(value, scope);
		expect(token.length).toBeLessThanOrEqual(4096);
		expect(decodeCollectionItemsCursor(token, scope)).toEqual(value);
	});
	it("rejects old plaintext, noncanonical, truncated and oversized encodings", () => {
		const token = encodeCollectionItemsCursor(boundary, scope);
		for (const bad of [
			Buffer.from(JSON.stringify({ v: 1, ...scope, ...boundary })).toString("base64url"),
			"ci2.A",
			"ci2." + "A".repeat(4096),
			token + "=",
			token.slice(0, -3),
		])
			expect(() => decodeCollectionItemsCursor(bad, scope)).toThrow(InvalidPaginationCursor);
		expect(decodeCollectionItemsCursor(undefined, scope)).toBeNull();
	});
	it("validates server-produced boundary values", () => {
		expect(() =>
			encodeCollectionItemsCursor({ ...boundary, targetId: "not-a-uuid" }, scope),
		).toThrow();
		expect(() =>
			encodeCollectionItemsCursor({ ...boundary, position: "~temporary" }, scope),
		).toThrow();
	});
});
