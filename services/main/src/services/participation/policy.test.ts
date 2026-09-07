import { describe, expect, it } from "vitest";
import {
	ParticipationAuthoritySchema,
	ParticipationDenied,
	runWithParticipationAuthority,
	currentParticipationAuthority,
	validateGrant,
	type ParticipationAuthority,
} from "./policy";
import type { participationGrant } from "../database/schema/participation";

const actor = "019f9ea5-5188-7f3a-8819-380ec28c0b11";
const entity = "019f9ea5-5188-7f3a-8819-380ec28c0b12";
const grantId = "019f9ea5-5188-7f3a-8819-380ec28c0b13";
const target = { owner: "music", id: "019f9ea5-5188-7f3a-8819-380ec28c0b14" } as const;
const authority: ParticipationAuthority = {
	principal: { kind: "auth", authUserId: actor },
	actingEntityId: entity,
	authorizationRevision: 1,
	grant: { id: grantId, revision: 3 },
};
const grant: typeof participationGrant.$inferSelect = {
	id: grantId,
	authUserId: actor,
	servicePrincipalId: null,
	actingEntityId: entity,
	capability: "catalog.edit",
	publishingId: null,
	musicId: target.id,
	programId: null,
	softwareId: null,
	entityId: null,
	groupingId: null,
	referenceId: null,
	distributionId: null,
	proposalId: null,
	proposalSourceRecordId: null,
	revision: 3,
	expiresAt: null,
	revokedAt: null,
	createdByAuthUserId: actor,
	createdAt: new Date(),
};

describe("current participation authority", () => {
	it("accepts exactly the admitted principal, public actor, capability and owner target", () => {
		expect(() => validateGrant(grant, authority, "catalog.edit", target, new Date())).not.toThrow();
	});
	it("allows a target's catalog editor to read that same target", () => {
		expect(() => validateGrant(grant, authority, "catalog.read", target, new Date())).not.toThrow();
	});
	it("requires the exact human-approved source proposal, even when the native target is the same", () => {
		const sourceRecordId = "019f9ea5-5188-7f3a-8819-380ec28c0b15";
		const proposalId = "019f9ea5-5188-7f3a-8819-380ec28c0b16";
		const approved = {
			...grant,
			capability: "proposal.adopt" as const,
			proposalSourceRecordId: sourceRecordId,
			proposalId,
		};
		expect(() =>
			validateGrant(approved, authority, "proposal.adopt", target, new Date(), {
				sourceRecordId,
				proposalId,
			}),
		).not.toThrow();
		expect(() => validateGrant(approved, authority, "proposal.adopt", target, new Date())).toThrow(
			ParticipationDenied,
		);
		expect(() =>
			validateGrant(approved, authority, "proposal.adopt", target, new Date(), {
				sourceRecordId,
				proposalId: actor,
			}),
		).toThrow(ParticipationDenied);
		expect(() => validateGrant(approved, authority, "catalog.edit", target, new Date())).toThrow(
			ParticipationDenied,
		);
	});
	it.each([
		{ revision: 4 },
		{ revokedAt: new Date() },
		{ expiresAt: new Date(0) },
		{ authUserId: entity },
		{ actingEntityId: actor },
		{ musicId: actor },
		{ capability: "entity.publish" as const },
	])("rejects changed or ineligible authority %o", (change) => {
		expect(() =>
			validateGrant({ ...grant, ...change }, authority, "catalog.edit", target, new Date()),
		).toThrow(ParticipationDenied);
	});
	it("does not promote catalog editing to publishing, membership or security authority", () => {
		for (const capability of [
			"entity.publish",
			"entity.membership",
			"entity.security",
			"proposal.adopt",
		] as const)
			expect(() => validateGrant(grant, authority, capability, target, new Date())).toThrow(
				ParticipationDenied,
			);
	});
	it("rejects account credentials pretending to be service credentials", () => {
		expect(
			ParticipationAuthoritySchema.safeParse({
				...authority,
				principal: { kind: "service", authUserId: actor },
			}).success,
		).toBe(false);
	});
	it("isolates concurrent queued command authority and restores absence", async () => {
		const other = { ...authority, actingEntityId: actor };
		const observed = await Promise.all(
			[authority, other].map((value) =>
				runWithParticipationAuthority(value, async () => {
					await Promise.resolve();
					return currentParticipationAuthority()?.actingEntityId;
				}),
			),
		);
		expect(observed).toEqual([entity, actor]);
		expect(currentParticipationAuthority()).toBeUndefined();
	});
});
