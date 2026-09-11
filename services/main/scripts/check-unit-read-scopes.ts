import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { and, eq, sql } from "drizzle-orm";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import { users } from "../src/services/database/schema/auth";
import { post } from "../src/services/database/schema/post";
import { unitAccessGrant, unitAccessRestriction } from "../src/services/database/schema/access";
import { Authorization } from "../src/services/authorization";
import { getUnitReadCondition } from "../src/services/authorization/unit/query";
import { createProfileOwnedUnitAccess } from "../src/services/authorization/unit/ownership";
import { UnitPermissionForbidden } from "../src/services/units/errors";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import type { ParticipationAuthority } from "../src/services/participation/policy";
import { createFixtureRestrictionDecision } from "./unit-access-fixture";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Read-scope checks require a disposable loopback target",
);

async function actor(tx: DatabaseTransaction, name: string) {
	const [account] = await tx
		.insert(users)
		.values({ name, email: `${crypto.randomUUID()}@example.invalid`, emailVerified: true })
		.returning();
	assert.ok(account);
	const self = await ensureSelfEntityInTransaction(tx, account);
	const authority: ParticipationAuthority = {
		principal: { kind: "auth", authUserId: account.id },
		actingEntityId: self.id,
		authorizationRevision: self.authorizationRevision,
	};
	return { account, self, authorization: new Authorization(self.id, account.id, authority) };
}
const rollback = new Error("rollback read-scope fixture");
let checks = 0;
function check(actual: unknown, expected: unknown, message: string) {
	assert.deepEqual(actual, expected, message);
	checks++;
}
try {
	await withDatabaseTransactionDeadline(20000, () =>
		database.transaction(async (tx) => {
			const owner = await actor(tx, "Read scope owner"),
				reader = await actor(tx, "Scoped reader");
			const [resource] = await tx
				.insert(post)
				.values({
					kind: "post",
					status: "published",
					visibility: "private",
					publishedAt: new Date(),
				})
				.returning();
			assert.ok(resource);
			await createProfileOwnedUnitAccess(tx, resource.id, owner.self.id);
			await tx.insert(unitAccessGrant).values({
				unitId: resource.id,
				subjectKind: "auth",
				authUserId: reader.account.id,
				permission: "unit.read",
				scope: ["section", "one"],
				grantedByAuthUserId: owner.account.id,
			});
			const decision = (scope: string[]) =>
				reader.authorization.unit.decideInTransaction(tx, resource.id, "unit.read", scope);
			const visible = async () =>
				(
					await tx
						.select({ id: post.id })
						.from(post)
						.where(and(eq(post.id, resource.id), getUnitReadCondition(reader.self.id, {}, post)))
				).some((row) => row.id === resource.id);
			check(await visible(), false, "root list predicate denies a descendant-only read grant");
			check(
				(await decision([])).allowed,
				false,
				"a scoped grant does not authorize the resource root",
			);
			await assert.rejects(
				reader.authorization.unit.ensureInTransaction(tx, resource.id, "unit.read"),
				UnitPermissionForbidden,
			);
			checks++;
			for (const scope of [
				["section", "one"],
				["section", "one", "child"],
			])
				check(
					(await decision(scope)).allowed,
					true,
					"a read grant covers its path and descendants",
				);
			for (const scope of [["section"], ["section", "two"], ["other"]])
				check(
					(await decision(scope)).allowed,
					false,
					"a read grant does not cover ancestors or siblings",
				);
			const restriction = await createFixtureRestrictionDecision(tx, {
				authUserId: reader.account.id,
				selfEntityId: owner.self.id,
				targetId: resource.id,
			});
			await tx.insert(unitAccessRestriction).values({
				unitId: resource.id,
				subjectKind: "auth",
				authUserId: reader.account.id,
				permission: "unit.read",
				scope: ["section", "one", "private"],
				createdByAuthUserId: owner.account.id,
				decisionId: restriction.id,
			});
			check(
				(await decision(["section", "one", "private"])).allowed,
				false,
				"a narrower restriction overrides the scoped grant",
			);
			check(
				(await decision(["section", "one", "public"])).allowed,
				true,
				"an unrelated descendant remains readable",
			);
			await tx.insert(unitAccessGrant).values({
				unitId: resource.id,
				subjectKind: "authenticated",
				permission: "unit.read",
				scope: ["shared"],
				grantedByAuthUserId: owner.account.id,
			});
			check(
				(await decision([])).allowed,
				false,
				"an authenticated scoped grant does not widen root access",
			);
			check(
				(await decision(["shared"])).allowed,
				true,
				"authenticated grants cover their declared scope",
			);
			check(
				(
					await new Authorization(undefined).unit.decideInTransaction(
						tx,
						resource.id,
						"unit.read",
						["shared"],
					)
				).allowed,
				false,
				"authenticated grants do not admit an anonymous reader",
			);
			await tx.insert(unitAccessGrant).values({
				unitId: resource.id,
				subjectKind: "auth",
				authUserId: reader.account.id,
				permission: "unit.read",
				scope: [],
				grantedByAuthUserId: owner.account.id,
			});
			check((await decision([])).allowed, true, "an explicit root grant authorizes root reads");
			check(await visible(), true, "root point and list decisions agree after a root grant");
			check(
				(await owner.authorization.unit.decideInTransaction(tx, resource.id, "unit.read")).allowed,
				true,
				"current ownership remains a root read authority",
			);
			throw rollback;
		}),
	);
} catch (cause) {
	if (cause !== rollback) throw cause;
}
const runtime = await database.execute(sql`select version() as postgres`);
const repository = new URL("../../../", import.meta.url);
const sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-unit-read-scopes.ts",
	"services/main/scripts/unit-access-fixture.ts",
	"services/main/src/services/authorization/unit/authorization.ts",
	"services/main/src/services/authorization/unit/query.ts",
	"libraries/access/src/scope.ts",
	"services/main/src/services/database/schema/access.ts",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(path, repository)))
		.digest("hex");
console.info(
	JSON.stringify({
		baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: fileURLToPath(repository),
			encoding: "utf8",
		}).trim(),
		sourceDigests,
		node: process.version,
		platform: `${process.platform}/${process.arch}`,
		checks,
		runtime: runtime.rows[0],
		allRowsRolledBack: true,
	}),
);
console.info(`Verified ${checks} scoped read decisions on real PostgreSQL.`);
process.exit(0);
