import { sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
const definitions = [
	{ key: "character.height", unit: "cm", field: "heightMillimetres", factor: 10 },
	{ key: "character.weight", unit: "kg", field: "weightGrams", factor: 1000 },
	{ key: "character.bust", unit: "cm", field: "bustMillimetres", factor: 10 },
	{ key: "character.waist", unit: "cm", field: "waistMillimetres", factor: 10 },
	{ key: "character.hips", unit: "cm", field: "hipsMillimetres", factor: 10 },
] as const;
export type NativeEntityMeasurement = {
	contextUnitId: null;
	heightMillimetres: number | null;
	weightGrams: number | null;
	bustMillimetres: number | null;
	waistMillimetres: number | null;
	hipsMillimetres: number | null;
};
/** Reads actual adopted global character facts. Callers must authorize the at-most-eight Entity IDs first.
 * Reviewed definition version 1 declares the cm/kg scalar grammar. Other meanings are not silently coerced.
 * At most 65 fact-history candidates per owner/property are inspected before exact current-head checks.
 * Conflicting or truncated evidence leaves that scalar unknown; no arbitrary source wins.
 */
export async function readNativeEntityMeasurements(
	tx: DatabaseTransaction,
	entityIds: readonly string[],
): Promise<ReadonlyMap<string, NativeEntityMeasurement>> {
	const ids = z
		.array(z.uuid())
		.max(8)
		.parse([...new Set(entityIds)]);
	if (!ids.length) return new Map();
	const values = sql.join(
		definitions.map((value) => sql`(${value.key}::text,${value.unit}::text)`),
		sql`, `,
	);
	const result = await tx.execute(sql`
  with wanted(key,unit) as (values ${values}), meanings as materialized (
   select d.key,r.id from wanted w join public.catalog_definition d on d.namespace='catalog' and d.key=w.key and d.kind='property'
   join public.catalog_definition_revision r on r.definition_id=d.id and r.version=1
   where r.value_kind='number' and r.constraints->>'unit'=w.unit and r.constraints->>'integer'='true'
  )
  select requested.id as owner_id,meanings.key,candidates.candidate_count,current_value.kind,current_value.number_value
  from unnest(${sql.param(ids)}::uuid[]) requested(id) cross join meanings
  left join lateral (
   select limited.*,count(*) over() as candidate_count from (
    select f.id,f.semantic_id,f.state,f.sealed_at,f.spoiler,f.purpose from public.entity_fact f
    where f.owner_id=requested.id and f.definition_revision_id=meanings.id order by f.id desc limit 65
   ) limited
  ) candidates on true
  left join public.entity_semantic_head head on head.owner_id=requested.id and head.semantic_id=candidates.semantic_id
  left join public.entity_semantic_revision revision on revision.owner_id=head.owner_id and revision.semantic_id=head.semantic_id and revision.version=head.version and revision.fact_id=candidates.id and revision.state='active'
  left join public.entity_fact_value_node current_value on current_value.owner_id=requested.id and current_value.fact_id=revision.fact_id and current_value.position=0
   and candidates.state='active' and candidates.sealed_at is not null and candidates.spoiler=0 and candidates.purpose='assertion'
 `);
	const rows = z
		.array(
			z.object({
				owner_id: z.uuid(),
				key: z.string(),
				candidate_count: z.union([z.string(), z.number()]).nullable(),
				kind: z.string().nullable(),
				number_value: z.union([z.string(), z.number()]).nullable(),
			}),
		)
		.parse(result.rows);
	return projectNativeMeasurements(ids, rows);
}

export function projectNativeMeasurements(
	ids: readonly string[],
	rows: readonly {
		owner_id: string;
		key: string;
		candidate_count: string | number | null;
		kind: string | null;
		number_value: string | number | null;
	}[],
): ReadonlyMap<string, NativeEntityMeasurement> {
	const output = new Map<string, NativeEntityMeasurement>();
	for (const ownerId of ids) {
		const measurement: NativeEntityMeasurement = {
			contextUnitId: null,
			heightMillimetres: null,
			weightGrams: null,
			bustMillimetres: null,
			waistMillimetres: null,
			hipsMillimetres: null,
		};
		let observed = false;
		for (const definition of definitions) {
			const facts = rows.filter((row) => row.owner_id === ownerId && row.key === definition.key);
			if (facts.some((row) => row.kind === "number" || row.kind === "null")) observed = true;
			if (facts.some((row) => Number(row.candidate_count) >= 65)) continue;
			const measured = new Set(
				facts.flatMap((row) => {
					if (row.kind !== "number" || row.number_value === null) return [];
					const value = Number(row.number_value) * definition.factor;
					return Number.isSafeInteger(value) && value >= 0 ? [value] : [];
				}),
			);
			if (measured.size === 1) measurement[definition.field] = [...measured][0] ?? null;
		}
		if (observed) output.set(ownerId, measurement);
	}
	return output;
}
