import { Client } from "pg";

import { adminDatabaseUrl } from "./admin-database";
import {
	IntegrityConstraints,
	parseIntegrityConstraintCommand,
	type IntegrityConstraint,
} from "./integrity-constraint-support";

type ConstraintState = {
	readonly table: string;
	readonly name: string;
	readonly validated: boolean;
};

type PostgreSqlError = Error & {
	readonly code?: string;
	readonly constraint?: string;
};

type TriggerDefinition = {
	readonly table: string;
	readonly name: string;
	readonly enabled: string;
	readonly definition: string;
};

function quotedIdentifier(identifier: string): string {
	if (!/^[a-z][a-z0-9_]{0,62}$/.test(identifier))
		throw new TypeError(`Unsafe PostgreSQL identifier: ${identifier}`);
	return `"${identifier}"`;
}

async function readStates(client: Client): Promise<readonly ConstraintState[]> {
	const names = IntegrityConstraints.map(({ name }) => name);
	const result = await client.query<ConstraintState>(
		`select relation.relname as "table",
		        constraint_state.conname as name,
		        constraint_state.convalidated as validated
		 from pg_constraint constraint_state
		 join pg_class relation on relation.oid = constraint_state.conrelid
		 join pg_namespace namespace on namespace.oid = relation.relnamespace
		 where namespace.nspname = 'public'
		   and constraint_state.conname = any($1::text[])
		 order by relation.relname, constraint_state.conname`,
		[names],
	);
	return result.rows;
}

async function requireCurrentState(
	client: Client,
	constraint: IntegrityConstraint,
): Promise<ConstraintState> {
	const states = await readStates(client);
	const state = states.find(({ name }) => name === constraint.name);
	if (!state || state.table !== constraint.table)
		throw new Error(`Missing public.${constraint.table}.${constraint.name}`);
	return state;
}

async function validate(client: Client, constraint: IntegrityConstraint): Promise<void> {
	const current = await requireCurrentState(client, constraint);
	if (current.validated) {
		console.info(`Already validated public.${constraint.table}.${constraint.name}`);
		return;
	}
	await client.query("begin");
	try {
		await client.query("set local lock_timeout = '5s'");
		await client.query(
			`alter table public.${quotedIdentifier(constraint.table)} validate constraint ${quotedIdentifier(constraint.name)}`,
		);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
	const validated = await requireCurrentState(client, constraint);
	if (!validated.validated) throw new Error(`PostgreSQL did not validate ${constraint.name}`);
	console.info(`Validated public.${constraint.table}.${constraint.name}`);
}

async function expectConstraintViolation(
	client: Client,
	statement: string,
	parameters: readonly unknown[],
	constraint: string,
): Promise<void> {
	await client.query("savepoint expected_constraint_violation");
	let failure: unknown;
	try {
		await client.query(statement, [...parameters]);
	} catch (error) {
		failure = error;
	}
	await client.query("rollback to savepoint expected_constraint_violation");
	await client.query("release savepoint expected_constraint_violation");
	const postgresError = failure as PostgreSqlError | undefined;
	if (postgresError?.code !== "23514" || postgresError.constraint !== constraint)
		throw new Error(`Expected PostgreSQL constraint ${constraint}`, { cause: failure });
}

async function proveReferenceMoveLimits(client: Client): Promise<void> {
	const sourceActiveUnitId = "019b0000-0000-7000-8000-000000000001";
	const fullActiveUnitId = "019b0000-0000-7000-8000-000000000002";
	const sourcePinnedUnitId = "019b0000-0000-7000-8000-000000000003";
	const fullPinnedUnitId = "019b0000-0000-7000-8000-000000000004";
	await client.query("begin");
	try {
		await client.query(
			`insert into public.unit (id, kind)
			 values ($1, 'book'), ($2, 'book'), ($3, 'book'), ($4, 'book')`,
			[sourceActiveUnitId, fullActiveUnitId, sourcePinnedUnitId, fullPinnedUnitId],
		);
		await client.query(
			`insert into public.unit_alias (unit_id, term, normalized_term)
			 select $1, 'active-' || ordinal::text, 'active-' || ordinal::text
			 from generate_series(1, 128) as ordinal`,
			[fullActiveUnitId],
		);
		const activeSource = await client.query<{ id: string }>(
			`insert into public.unit_alias (unit_id, term, normalized_term)
			 values ($1, 'move-active', 'move-active') returning id`,
			[sourceActiveUnitId],
		);
		const activeSourceId = activeSource.rows[0]?.id;
		if (!activeSourceId) throw new Error("Active reference fixture was not created");
		await expectConstraintViolation(
			client,
			"update public.unit_alias set unit_id = $1 where id = $2",
			[fullActiveUnitId, activeSourceId],
			"unit_reference_active_limit",
		);

		await client.query(
			`insert into public.unit_alias (unit_id, term, normalized_term, pinned, "position")
			 select $1, 'pinned-' || ordinal::text, 'pinned-' || ordinal::text,
			        true, 'fixture-' || lpad(ordinal::text, 3, '0')
			 from generate_series(1, 16) as ordinal`,
			[fullPinnedUnitId],
		);
		const pinnedSource = await client.query<{ id: string }>(
			`insert into public.unit_alias (
				unit_id, term, normalized_term, pinned, "position"
			 ) values ($1, 'move-pinned', 'move-pinned', true, 'fixture-source')
			 returning id`,
			[sourcePinnedUnitId],
		);
		const pinnedSourceId = pinnedSource.rows[0]?.id;
		if (!pinnedSourceId) throw new Error("Pinned reference fixture was not created");
		await expectConstraintViolation(
			client,
			"update public.unit_alias set unit_id = $1 where id = $2",
			[fullPinnedUnitId, pinnedSourceId],
			"unit_reference_pinned_limit",
		);
		await client.query("rollback");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
	console.info("Verified Alias active and pinned limits on direct unit_id moves");
}

async function proveReferenceMoveTriggers(client: Client): Promise<void> {
	const triggerNames = [
		"unit_alias_reference_limits",
		"unit_external_link_reference_limits",
	] as const;
	const result = await client.query<TriggerDefinition>(
		`select relation.relname as "table",
		        trigger.tgname as name,
		        trigger.tgenabled as enabled,
		        pg_get_triggerdef(trigger.oid, true) as definition
		 from pg_trigger trigger
		 join pg_class relation on relation.oid = trigger.tgrelid
		 join pg_namespace namespace on namespace.oid = relation.relnamespace
		 where namespace.nspname = 'public'
		   and trigger.tgname = any($1::text[])`,
		[triggerNames],
	);
	for (const expected of [
		{ table: "unit_alias", name: triggerNames[0], kind: "alias" },
		{
			table: "unit_external_link",
			name: triggerNames[1],
			kind: "external_link",
		},
	] as const) {
		const trigger = result.rows.find(({ name }) => name === expected.name);
		const definition = trigger?.definition.toLowerCase().replaceAll(/\s+/g, " ");
		const updatedColumns = new Set(
			definition
				?.match(/before insert or update of (.+?) on /)?.[1]
				?.split(",")
				.map((column) => column.trim().replaceAll('"', "")) ?? [],
		);
		if (
			trigger?.table !== expected.table ||
			trigger.enabled !== "O" ||
			!["unit_id", "withdrawn_at", "pinned"].every((column) => updatedColumns.has(column)) ||
			!definition?.includes(`enforce_unit_reference_limits('${expected.kind}')`)
		)
			throw new Error(
				`Reference-limit trigger ${expected.name} is not move-safe: ${trigger?.definition ?? "missing"}`,
			);
	}
	console.info("Verified Alias and External Link reference-limit trigger coverage");
}

async function main(): Promise<void> {
	const command = parseIntegrityConstraintCommand(process.argv.slice(2));
	const client = new Client({ connectionString: adminDatabaseUrl });
	await client.connect();
	try {
		if (command.action === "status") {
			const states = await readStates(client);
			const stateByName = new Map(states.map((state) => [state.name, state] as const));
			const selected = command.constraint ? [command.constraint] : IntegrityConstraints;
			for (const constraint of selected) {
				const state = stateByName.get(constraint.name);
				const status =
					state?.table === constraint.table
						? state.validated
							? "validated"
							: "not validated"
						: "missing";
				console.info(`public.${constraint.table}.${constraint.name}: ${status}`);
			}
			return;
		}
		if (command.action === "validate") {
			await validate(client, command.constraint);
			return;
		}

		const database = await client.query<{ name: string }>("select current_database() as name");
		if (database.rows[0]?.name !== "rezics_atlas")
			throw new Error(
				"Bulk validation is restricted to the disposable rezics_atlas database",
			);
		for (const constraint of IntegrityConstraints) await validate(client, constraint);
		await proveReferenceMoveLimits(client);
		await proveReferenceMoveTriggers(client);
	} finally {
		await client.end();
	}
}

await main();
