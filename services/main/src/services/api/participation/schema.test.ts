import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { participationGrant } from "../../database/schema/participation";
import { IssueGrantInputSchema } from "../../participation/commands";
import { presentParticipationGrant } from "./present";
import * as schemas from "./schema";

const authId = "019f9ea5-5188-7f3a-8819-380ec28c0b11";
const entityId = "019f9ea5-5188-7f3a-8819-380ec28c0b12";
const targetId = "019f9ea5-5188-7f3a-8819-380ec28c0b13";
describe("participation JSON wire contracts", () => {
	it("exports JSON-schema-representable bodies and responses", () => {
		let checked = 0;
		for (const schema of Object.values(schemas))
			if (schema instanceof z.ZodType) {
				expect(() => z.toJSONSchema(schema)).not.toThrow();
				checked++;
			}
		expect(checked).toBeGreaterThan(10);
	});
	it("accepts an ISO expiry and public account address while keeping native Date conversion at the command boundary", () => {
		const input = {
			recipient: { kind: "account", entityId },
			actingEntityId: entityId,
			capability: "catalog.edit",
			target: { owner: "music", id: targetId },
			expiresAt: "2030-01-01T00:00:00.000Z",
		};
		const wire = schemas.IssueGrantBodySchema.parse(input);
		expect(
			schemas.IssueGrantBodySchema.safeParse({ ...input, expiresAt: new Date() }).success,
		).toBe(false);
		const native = IssueGrantInputSchema.parse({
			...wire,
			recipient: { kind: "auth", authUserId: authId },
		});
		expect(native.expiresAt).toBeInstanceOf(Date);
	});
	it("projects grant targets without exposing private issuer or recipient Auth identities", () => {
		const row: typeof participationGrant.$inferSelect = {
			id: "019f9ea5-5188-7f3a-8819-380ec28c0b14",
			authUserId: authId,
			servicePrincipalId: null,
			actingEntityId: entityId,
			capability: "catalog.edit",
			proposalSourceRecordId: null,
			proposalId: null,
			publishingId: null,
			musicId: targetId,
			programId: null,
			softwareId: null,
			entityId: null,
			groupingId: null,
			referenceId: null,
			distributionId: null,
			revision: 1,
			expiresAt: null,
			revokedAt: null,
			createdByAuthUserId: authId,
			createdAt: new Date(),
		};
		const result = presentParticipationGrant(row);
		expect(result.target).toEqual({ owner: "music", id: targetId });
		expect(JSON.stringify(result)).not.toContain(authId);
		expect(result.createdAt).toBeTypeOf("string");
	});
});
