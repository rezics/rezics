import { type SQL, type SQLWrapper, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseSelect = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({
	database: { select: databaseSelect },
}));
vi.mock("../authorization/unit/query", () => ({
	getUnitReadCondition: () => sql`true`,
}));

import { currentUnitTagJudgmentStat } from "../database/schema";
import { listGlobalUnitTags, listRealmVotedTags } from "./service";

interface JoinCapture {
	readonly table: unknown;
	readonly condition: SQL | undefined;
}

interface QueryCapture {
	readonly joins: JoinCapture[];
	readonly wheres: (SQL | undefined)[];
	readonly builder: {
		from(table: unknown): QueryCapture["builder"];
		innerJoin(table: unknown, condition?: SQL): QueryCapture["builder"];
		leftJoin(table: unknown, condition?: SQL): QueryCapture["builder"];
		where(condition?: SQL): QueryCapture["builder"];
		orderBy(...expressions: unknown[]): QueryCapture["builder"];
		limit(limit: number): Promise<readonly unknown[]>;
		as(alias: string): Record<string, SQLWrapper>;
		then: Promise<readonly unknown[]>["then"];
	};
}

function captureQuery(
	selection: Record<string, SQLWrapper>,
	rows: readonly unknown[] = [],
): QueryCapture {
	const joins: JoinCapture[] = [];
	const wheres: (SQL | undefined)[] = [];
	const result = Promise.resolve(rows);
	let builder: QueryCapture["builder"];
	builder = {
		from: () => builder,
		innerJoin: (table, condition) => {
			joins.push({ table, condition });
			return builder;
		},
		leftJoin: (table, condition) => {
			joins.push({ table, condition });
			return builder;
		},
		where: (condition) => {
			wheres.push(condition);
			return builder;
		},
		orderBy: () => builder,
		limit: async () => rows,
		as: () => selection,
		then: result.then.bind(result),
	};
	return { builder, joins, wheres };
}

const dialect = new PgDialect();

function renderCondition(condition: SQL | undefined) {
	if (!condition) throw new Error("Expected query condition was not captured");
	return dialect.sqlToQuery(condition);
}

describe("Tag judgment-stat fit consumers", () => {
	beforeEach(() => {
		databaseSelect.mockReset();
	});

	it("ignores spoiler-only Unit Tag stats when joining fit-ranking aggregates", async () => {
		let query: QueryCapture | undefined;
		databaseSelect.mockImplementationOnce((selection: Record<string, SQLWrapper>) => {
			query = captureQuery(selection);
			return query.builder;
		});

		await listGlobalUnitTags({
			unitId: "019f94d1-c8ca-7110-b984-b0614ba4db9c",
			limit: 20,
		});

		const statJoin = query?.joins.find(({ table }) => table === currentUnitTagJudgmentStat);
		const rendered = renderCondition(statJoin?.condition);
		expect(rendered.sql).toContain('"current_unit_tag_judgment_stat"."vote_count" >');
		expect(rendered.sql).not.toContain("spoiler_vote_count");
		expect(rendered.params).toContain(0n);
	});

	it("removes spoiler-only Realm Tag stats before fit ranking and per-Realm limits", async () => {
		let rankedQuery: QueryCapture | undefined;
		databaseSelect
			.mockImplementationOnce((selection: Record<string, SQLWrapper>) => {
				rankedQuery = captureQuery(selection);
				return rankedQuery.builder;
			})
			.mockImplementationOnce(
				(selection: Record<string, SQLWrapper>) => captureQuery(selection).builder,
			);

		await listRealmVotedTags({
			unitId: "019f94d1-c8ca-7110-b984-b0614ba4db9c",
			viewerProfileId: "019f94d1-c8ca-7110-b984-b0614ba4db9d",
			realmIds: ["019f94d1-c8ca-7110-b984-b0614ba4db9e"],
			perRealmLimit: 12,
		});

		const rendered = renderCondition(rankedQuery?.wheres[0]);
		expect(rendered.sql).toContain('"realm_tag_judgment_stat"."vote_count" >');
		expect(rendered.sql).not.toContain("spoiler_vote_count");
		expect(rendered.params).toContain(0n);
	});
});
