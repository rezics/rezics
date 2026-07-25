import { eq } from "drizzle-orm";

import { database } from "../database";
import { realm } from "../database/schema";
import { ScoreContextUnitUnsupported } from "./errors";

export const SupportedScoreContextUnitKinds = ["realm"] as const;
export type SupportedScoreContextUnitKind = (typeof SupportedScoreContextUnitKinds)[number];

export type ResolvedScoreContext = {
	readonly contextUnitId: string;
	readonly kind: SupportedScoreContextUnitKind;
};

export interface ScoreContextReadAuthorization {
	readonly unit: {
		ensureCanRead(unitId: string): Promise<void>;
	};
}

export interface ScoreContextParticipationAuthorization extends ScoreContextReadAuthorization {
	readonly realm: {
		ensureParticipation(realmId: string): Promise<void>;
	};
}

export async function resolveScoreContext(
	authorization: ScoreContextReadAuthorization,
	contextUnitId: string,
): Promise<ResolvedScoreContext> {
	await authorization.unit.ensureCanRead(contextUnitId);
	const [contextRealm] = await database
		.select({ id: realm.id })
		.from(realm)
		.where(eq(realm.id, contextUnitId))
		.limit(1);
	if (!contextRealm) throw new ScoreContextUnitUnsupported();
	return { contextUnitId: contextRealm.id, kind: "realm" };
}

export async function ensureScoreContextParticipation(
	authorization: ScoreContextParticipationAuthorization,
	contextUnitId: string,
): Promise<ResolvedScoreContext> {
	const context = await resolveScoreContext(authorization, contextUnitId);
	await authorization.realm.ensureParticipation(context.contextUnitId);
	return context;
}
