import { createHash } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { accessGroup, accessGroupEvent, accessGroupTree } from "../database/schema/access-group";

const versionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const presentationSchema = z.strictObject({
	label: z
		.string()
		.refine((value) => value.trim().length > 0 && Buffer.byteLength(value, "utf8") <= 512),
	description: z
		.string()
		.refine((value) => Buffer.byteLength(value, "utf8") <= 4096)
		.nullable(),
});
const base = {
	scopeId: z.uuid(),
	groupId: z.uuid(),
	expectedVersion: versionSchema,
	operationId: z.uuid(),
	operatorAuthUserId: z.uuid(),
	authoritySubjectId: z.uuid(),
};
const commandSchema = z.discriminatedUnion("operation", [
	z.strictObject({
		...base,
		operation: z.literal("create"),
		parentId: z.uuid().nullable(),
		presentation: presentationSchema,
	}),
	z.strictObject({ ...base, operation: z.literal("update"), presentation: presentationSchema }),
	z.strictObject({ ...base, operation: z.literal("reparent"), parentId: z.uuid().nullable() }),
	z.strictObject({ ...base, operation: z.literal("retire") }),
]);
/** One Group transition with an exact optimistic precondition and captured private attribution. @internal */
export type AccessGroupCommand = z.infer<typeof commandSchema>;
/** An immutable command result; its historical parent is not current authorization evidence. @internal */
export interface AccessGroupReceipt {
	groupId: string;
	operationId: string;
	version: number;
	state: "active" | "retired";
	parentId: string | null;
}
/** Group identity, state, parent selection or operation receipt conflicts with the command. @internal */
export class AccessGroupConflict extends Error {
	constructor() {
		super("Group command conflicts with its state or operation receipt");
	}
}
/** Current management and assignment-impact admission denied the command. @internal */
export class AccessGroupAdmissionDenied extends Error {
	constructor() {
		super("Current Group authority and admission are required");
	}
}
/** Missing authority remains distinct from a known policy denial. @internal */
export class AccessGroupAdmissionUnavailable extends Error {
	constructor() {
		super("Group admission is unavailable");
	}
}
function requireAdmission(value: boolean | null | undefined) {
	if (value === false) throw new AccessGroupAdmissionDenied();
	if (value !== true) throw new AccessGroupAdmissionUnavailable();
}
function receipt(row: typeof accessGroupEvent.$inferSelect): AccessGroupReceipt {
	return {
		groupId: row.groupId,
		operationId: row.operationId,
		version: row.version,
		state: row.stateAfter,
		parentId: row.parentAfterId,
	};
}

/**
 * Apply a Group transition under its scope's topology fence and a rollback-safe savepoint.
 * @internal
 * @remarks The owner acquires its complete authority fences first, promoting this
 * tree fence upfront when also used by its authority. Admission includes current
 * management, assignment ceilings and the reviewed topology impact. It is a
 * side-effect-free SQL predicate evaluated before provisional writes, after waits
 * and in the final mutation. This store proves neither authority nor roster disclosure.
 */
export async function applyAccessGroupCommand(
	tx: DatabaseTransaction,
	input: AccessGroupCommand,
	admission: SQL<boolean | null>,
): Promise<AccessGroupReceipt> {
	const command = commandSchema.parse(input),
		requestDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return tx.transaction(async (work) => {
		const authorize = async () =>
			requireAdmission(
				(await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`))
					.rows[0]?.admitted,
			);
		await authorize();
		await work.insert(accessGroupTree).values({ scopeId: command.scopeId }).onConflictDoNothing();
		const [tree] = await work
			.select()
			.from(accessGroupTree)
			.where(eq(accessGroupTree.scopeId, command.scopeId))
			.for("update");
		if (!tree) throw new AccessGroupConflict();
		await authorize();
		if (command.operation === "create")
			await work
				.insert(accessGroup)
				.values({ id: command.groupId, scopeId: command.scopeId })
				.onConflictDoNothing({ target: accessGroup.id });
		const [head] = await work
			.select()
			.from(accessGroup)
			.where(and(eq(accessGroup.id, command.groupId), eq(accessGroup.scopeId, command.scopeId)))
			.for("update");
		if (!head) throw new AccessGroupConflict();
		await authorize();
		const [prior] = await work
			.select()
			.from(accessGroupEvent)
			.where(
				and(
					eq(accessGroupEvent.groupId, head.id),
					eq(accessGroupEvent.operationId, command.operationId),
				),
			)
			.limit(1);
		if (prior) {
			if (
				prior.requestDigest !== requestDigest ||
				prior.operatorAuthUserId !== command.operatorAuthUserId ||
				prior.authoritySubjectId !== command.authoritySubjectId
			)
				throw new AccessGroupConflict();
			return receipt(prior);
		}
		if (
			head.version !== command.expectedVersion ||
			head.state === "retired" ||
			(command.operation === "create") !== (head.state === "draft")
		)
			throw new AccessGroupConflict();
		const [previous] =
			head.version === 0
				? []
				: await work
						.select()
						.from(accessGroupEvent)
						.where(
							and(
								eq(accessGroupEvent.groupId, head.id),
								eq(accessGroupEvent.version, head.version),
							),
						)
						.limit(1);
		const presentation =
			command.operation === "create" || command.operation === "update"
				? command.presentation
				: previous;
		if (!presentation) throw new AccessGroupConflict();
		const parentId =
			command.operation === "create" || command.operation === "reparent"
				? command.parentId
				: command.operation === "retire"
					? null
					: head.parentId;
		if (
			(command.operation === "reparent" && parentId === head.parentId) ||
			(command.operation === "update" &&
				presentation.label === previous?.label &&
				presentation.description === previous.description)
		)
			throw new AccessGroupConflict();
		// Lock the bounded old/new ancestor closure before the final admission clock check.
		// Height propagation and parent FKs must not introduce a later row-lock wait.
		await work.execute(sql`
   with recursive ancestry(id,depth) as (
    select root,1 from (values(${head.id}::uuid),(${parentId}::uuid)) roots(root) where root is not null
    union all select g.parent_id,a.depth+1 from ancestry a join public.access_group g on g.id=a.id and g.scope_id=${command.scopeId}::uuid where g.parent_id is not null and a.depth<8
   ) select g.id from public.access_group g where g.scope_id=${command.scopeId}::uuid and g.id in(select id from ancestry) order by g.id for update`);
		if (parentId !== null) {
			const [parent] = await work
				.select({ state: accessGroup.state })
				.from(accessGroup)
				.where(and(eq(accessGroup.id, parentId), eq(accessGroup.scopeId, command.scopeId)))
				.limit(1);
			if (!parent || parent.state !== "active") throw new AccessGroupConflict();
		}
		await authorize();
		const version = head.version + 1,
			state = command.operation === "retire" ? ("retired" as const) : ("active" as const);
		const [event] = await work
			.insert(accessGroupEvent)
			.values({
				groupId: head.id,
				version,
				operationId: command.operationId,
				requestDigest,
				operation: command.operation,
				stateAfter: state,
				parentAfterId: parentId,
				label: presentation.label,
				description: presentation.description,
				operatorAuthUserId: command.operatorAuthUserId,
				authoritySubjectId: command.authoritySubjectId,
			})
			.returning();
		if (!event) throw Error("Group receipt was not written");
		const result = await work.execute<{ admitted: boolean | null; changed: string | null }>(sql`
   with admission as materialized(select (${admission}) as admitted),changed as(
    update public.access_group set version=${version},state=${state},parent_id=${parentId}::uuid
    where id=${head.id}::uuid and version=${head.version} and(select admitted from admission) is true returning id
   ) select(select admitted from admission) as admitted,(select id from changed) as changed`);
		requireAdmission(result.rows[0]?.admitted);
		if (!result.rows[0]?.changed) throw new AccessGroupConflict();
		return receipt(event);
	});
}

/**
 * Read one exact Group snapshot. Current reads retain a shared topology fence through commit.
 * @internal
 * @remarks No roster, permission or representation is inferred from this snapshot.
 * Historical parent IDs remain historical selections, even if those Groups retire.
 */
export async function readAccessGroupSnapshot(
	tx: DatabaseTransaction,
	input: { scopeId: string; groupId: string; version: number | "current" },
) {
	z.uuid().parse(input.scopeId);
	z.uuid().parse(input.groupId);
	if (input.version !== "current") versionSchema.min(1).parse(input.version);
	if (input.version === "current") {
		const [tree] = await tx
			.select({ scopeId: accessGroupTree.scopeId })
			.from(accessGroupTree)
			.where(eq(accessGroupTree.scopeId, input.scopeId))
			.for("share");
		if (!tree) return null;
	}
	const [row] = await tx
		.select({
			groupId: accessGroupEvent.groupId,
			version: accessGroupEvent.version,
			state: accessGroupEvent.stateAfter,
			parentId: accessGroupEvent.parentAfterId,
			label: accessGroupEvent.label,
			description: accessGroupEvent.description,
		})
		.from(accessGroup)
		.innerJoin(
			accessGroupEvent,
			and(
				eq(accessGroup.id, accessGroupEvent.groupId),
				input.version === "current"
					? eq(accessGroup.version, accessGroupEvent.version)
					: eq(accessGroupEvent.version, input.version),
			),
		)
		.where(and(eq(accessGroup.id, input.groupId), eq(accessGroup.scopeId, input.scopeId)))
		.limit(1);
	return row ?? null;
}
