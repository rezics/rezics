import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	musicArtistCredit,
	musicAlternativeTrack,
	musicComponentRevision,
	musicComponentHead,
} from "@rezics/schema/postgres/music/music";
import { readCatalogAuthorityScope } from "../participation/policy";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";
import { CatalogAccessDenied, loadCatalogIdentity } from "./storage";

/** @internal Private fragments need direct creator authority, an editable creation context, or exact authorized native reference history. */
export async function requireMusicCreditAccess(
	tx: DatabaseTransaction,
	actor: string | null,
	input: readonly (string | null | undefined)[],
	context?: {
		reference: CatalogReference;
		write?: boolean;
		historyIds?: readonly string[];
	},
) {
	const ids = z
		.array(z.uuid())
		.max(128)
		.parse([...new Set(input.filter((id): id is string => id != null))]);
	if (!ids.length) return [];
	const scope = await readCatalogAuthorityScope(tx, actor);
	const linked = new Set<string>();
	if (context) {
		if (context.reference.owner !== "music")
			throw new TypeError("Credit reference proof requires a music owner");
		await loadCatalogIdentity(tx, context.reference, actor, context.write ?? false, "share");
		const historyIds = z
			.array(z.uuid())
			.max(256)
			.parse([...new Set(context.historyIds ?? [])]);
		if (historyIds.length) {
			const history = musicComponentRevision;
			const rows = await tx
				.select({
					id: history.id,
					artistCreditId: sql<string | null>`${history.value}->>'artist_credit_id'`,
					alternativeTrackId: sql<string | null>`${history.value}->>'alternative_track_id'`,
				})
				.from(history)
				.where(
					and(
						eq(history.ownerId, context.reference.id),
						inArray(history.id, historyIds),
						context.write ? undefined : sql`${history.operation} <> 'DELETE'`,
						context.write
							? undefined
							: sql`exists (select 1 from ${musicComponentHead} where ${musicComponentHead.ownerId}=${history.ownerId} and ${musicComponentHead.component}=${history.component} and ${musicComponentHead.componentKey}=${history.componentKey} and ${musicComponentHead.historyId}=${history.id})`,
					),
				)
				.limit(historyIds.length);
			if (rows.length !== historyIds.length)
				throw new CatalogAccessDenied(
					"Credit reference history is not available in this native context",
				);
			for (const row of rows)
				if (row.artistCreditId) linked.add(z.uuid().parse(row.artistCreditId));
			const alternativeIds = [
				...new Set(
					rows.flatMap((row) =>
						row.alternativeTrackId ? [z.uuid().parse(row.alternativeTrackId)] : [],
					),
				),
			];
			if (alternativeIds.length) {
				const alternatives = await tx
					.select({ creditId: musicAlternativeTrack.artistCreditId })
					.from(musicAlternativeTrack)
					.where(inArray(musicAlternativeTrack.id, alternativeIds))
					.limit(alternativeIds.length);
				for (const alternative of alternatives)
					if (alternative.creditId) linked.add(alternative.creditId);
			}
		}
	}
	const credits = await tx
		.select()
		.from(musicArtistCredit)
		.where(inArray(musicArtistCredit.id, ids))
		.limit(ids.length);
	if (
		credits.length !== ids.length ||
		credits.some(
			(credit) =>
				!credit.sealedAt ||
				credit.retiredAt ||
				!(
					credit.publiclyReusable ||
					(scope.creatorAuthUserId !== null &&
						credit.createdByAuthUserId === scope.creatorAuthUserId) ||
					(context?.write && credit.createdForMusicId === context.reference.id) ||
					linked.has(credit.id)
				),
		)
	)
		throw new CatalogAccessDenied(
			"Artist credit has no readable native reference or authorized creation context",
		);
	return credits;
}

/** @internal Bounded current component heads provide exact credit-reference proofs without scanning a release's history. */
export async function musicCreditReferenceHeads(
	tx: DatabaseTransaction,
	ownerId: string,
	component: string,
	keys: readonly string[],
) {
	const ids = z
		.array(z.string().min(1).max(1536))
		.max(128)
		.parse([...new Set(keys)]);
	if (!ids.length) return [];
	const table = musicComponentHead;
	const rows = await tx
		.select({ id: table.historyId })
		.from(table)
		.where(
			and(
				eq(table.ownerId, ownerId),
				eq(table.component, component),
				inArray(table.componentKey, ids),
			),
		)
		.limit(ids.length);
	return rows.map((row) => row.id);
}
