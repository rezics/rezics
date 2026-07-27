import { getActiveTraceContext } from "@rezics/observability";

import type { DatabaseExecutor } from "../database";
import { auditEvent } from "../database/schema";
import type { AuditRecord } from "./contracts";
import { getAuditRequestContext } from "./context";

/**
 * Appends one immutable security audit record.
 *
 * Success records must use the same transaction as the mutation they describe.
 * Denials and system failures may use the root database executor because there
 * is no successful domain transaction to commit.
 */
export async function recordAuditEvent(
	executor: DatabaseExecutor,
	record: AuditRecord,
): Promise<void> {
	const requestContext = getAuditRequestContext();
	const traceContext = getActiveTraceContext();
	await executor.insert(auditEvent).values({
		schemaVersion: 2,
		category: record.category,
		outcome: record.outcome,
		actorKind: record.actor.kind,
		actorProfileId: record.actor.kind === "profile" ? record.actor.profileId : null,
		actorCredentialKind:
			record.actor.kind === "profile"
				? (record.actor.credentialKind ?? requestContext?.credentialKind ?? "session")
				: (record.actor.credentialKind ?? "system"),
		actorCredentialId:
			record.actor.kind === "profile"
				? (record.actor.credentialId ?? requestContext?.credentialId)
				: record.actor.credentialId,
		authorityKind: record.authority.kind,
		authorityId: record.authority.kind === "platform" ? null : record.authority.id,
		action: record.action,
		reasonCode: record.reasonCode,
		requestId: record.requestId ?? requestContext?.requestId,
		traceId: record.traceId ?? traceContext?.traceId,
		targetKind: record.target?.kind,
		targetId: record.target?.id,
		targetPath: record.target?.path,
		details: record.details ? { ...record.details } : undefined,
		createdAt: record.createdAt,
	});
}
