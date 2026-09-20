import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { database } from "../src/services/database";
import { users } from "@rezics/schema/postgres/identity/auth";
import { authEntity } from "@rezics/schema/postgres/access/participation";
import { conversation } from "@rezics/schema/postgres/messaging/communication";
import {
	conversationParticipantStat,
	conversationStat,
} from "@rezics/schema/postgres/discovery/aggregate";
import { createSeedParticipant } from "../src/services/seed/enrollment";
import { assertNativeEnrollmentFixture } from "./native-enrollment-fixture";
assertNativeEnrollmentFixture();
const rollback = new Error("Rollback conversation statistics qualification");
let checks = 0;
try {
	await assert.rejects(
		database.transaction(async (tx) => {
			const actors = [];
			for (let index = 0; index < 2; index++) {
				const [account] = await tx
					.insert(users)
					.values({
						name: "Conversation statistics fixture",
						email: `${randomUUID()}@conversation-fixture.invalid`,
						emailVerified: true,
					})
					.returning();
				assert.ok(account);
				const identity = await createSeedParticipant(tx, account.id, {
					language: "en",
					value: `Fixture participant ${index}`,
				});
				await tx.insert(authEntity).values({ authUserId: account.id, entityId: identity.id });
				actors.push({ authId: account.id, entityId: identity.id });
			}
			actors.sort((a, b) => (a.authId < b.authId ? -1 : 1));
			const [low, high] = actors;
			assert.ok(low && high);
			const [direct] = await tx
				.insert(conversation)
				.values({
					kind: "direct",
					participantLowAuthUserId: low.authId,
					participantHighAuthUserId: high.authId,
					participantLowEntityId: low.entityId,
					participantHighEntityId: high.entityId,
				})
				.returning();
			assert.ok(direct);
			assert.equal(
				(
					await tx
						.select()
						.from(conversationStat)
						.where(eq(conversationStat.conversationId, direct.id))
				).length,
				1,
			);
			checks++;
			const participants = await tx
				.select()
				.from(conversationParticipantStat)
				.where(eq(conversationParticipantStat.conversationId, direct.id))
				.orderBy(conversationParticipantStat.authUserId);
			assert.deepEqual(
				participants.map((row) => row.authUserId),
				[low.authId, high.authId],
			);
			checks++;
			assert.ok(
				participants.every(
					(row) => row.unreadCount === 0n && row.sortAt.getTime() === direct.createdAt.getTime(),
				),
			);
			checks++;
			const [group] = await tx.insert(conversation).values({ kind: "group" }).returning();
			assert.ok(group);
			assert.equal(
				(
					await tx
						.select()
						.from(conversationStat)
						.where(eq(conversationStat.conversationId, group.id))
				).length,
				1,
			);
			checks++;
			assert.equal(
				(
					await tx
						.select()
						.from(conversationParticipantStat)
						.where(eq(conversationParticipantStat.conversationId, group.id))
				).length,
				0,
			);
			checks++;
			throw rollback;
		}),
		(error) => error === rollback,
	);
	console.info(
		JSON.stringify({
			checks,
			directParticipants: 2,
			groupParticipantsNotInferred: true,
			rolledBack: true,
		}),
	);
} finally {
	await database.$client.end();
}
