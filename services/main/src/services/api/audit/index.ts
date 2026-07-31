import { and, desc, eq, lt, or, type SQL } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import Elysia from "elysia";

import session from "../../auth/session";
import { database } from "../../database";
import { auditEvent, AuditEventSchemaVersion } from "../../database/schema";
import { InvalidPaginationCursor } from "../../pagination/errors";
import { firstUnitLocalizationTitle } from "../../units/localization";
import { toApiErrorResponse } from "../schema/response";
import { decodeAuditCursor, encodeAuditCursor } from "./cursor";
import { AuditEventListResponse, AuditEventsQuery } from "./schema";

export default new Elysia({ prefix: "/audit" }).use(session).get(
	"/events",
	async ({ authorization, query }) => {
		await authorization.platform.ensureCapability("platform.audit.read");
		const predicates: SQL[] = [];
		if (query.category) predicates.push(eq(auditEvent.category, query.category));
		if (query.outcome) predicates.push(eq(auditEvent.outcome, query.outcome));
		if (query.action) predicates.push(eq(auditEvent.action, query.action));
		if (query.actorProfileId)
			predicates.push(eq(auditEvent.actorProfileId, query.actorProfileId));
		if (query.authorityKind) predicates.push(eq(auditEvent.authorityKind, query.authorityKind));
		if (query.authorityId) predicates.push(eq(auditEvent.authorityId, query.authorityId));
		if (query.targetId) predicates.push(eq(auditEvent.targetId, query.targetId));
		const cursor = query.cursor ? decodeAuditCursor(query.cursor) : undefined;
		if (query.cursor && !cursor) throw new InvalidPaginationCursor();
		if (cursor) {
			const createdAt = new Date(cursor.createdAt);
			predicates.push(
				or(
					lt(auditEvent.createdAt, createdAt),
					and(eq(auditEvent.createdAt, createdAt), lt(auditEvent.id, cursor.id)),
				)!,
			);
		}
		const limit = query.limit ?? 50;
		const rows = await database
			.select({
				id: auditEvent.id,
				schemaVersion: auditEvent.schemaVersion,
				category: auditEvent.category,
				outcome: auditEvent.outcome,
				actorKind: auditEvent.actorKind,
				actorProfileId: auditEvent.actorProfileId,
				actorName: firstUnitLocalizationTitle(auditEvent.actorProfileId),
				actorCredentialKind: auditEvent.actorCredentialKind,
				actorCredentialId: auditEvent.actorCredentialId,
				authorityKind: auditEvent.authorityKind,
				authorityId: auditEvent.authorityId,
				action: auditEvent.action,
				reasonCode: auditEvent.reasonCode,
				requestId: auditEvent.requestId,
				traceId: auditEvent.traceId,
				targetKind: auditEvent.targetKind,
				targetId: auditEvent.targetId,
				targetPath: auditEvent.targetPath,
				targetName: firstUnitLocalizationTitle(auditEvent.targetId),
				details: auditEvent.details,
				createdAt: auditEvent.createdAt,
			})
			.from(auditEvent)
			.where(predicates.length ? and(...predicates) : undefined)
			.orderBy(desc(auditEvent.createdAt), desc(auditEvent.id))
			.limit(limit + 1);
		const hasNext = rows.length > limit;
		const page = rows.slice(0, limit);
		if (page.some((row) => row.schemaVersion !== AuditEventSchemaVersion))
			throw new Error("Unsupported audit event schema version");
		const last = page.at(-1);
		return {
			items: page.map((row) => ({
				id: row.id,
				schemaVersion: AuditEventSchemaVersion,
				category: row.category,
				outcome: row.outcome,
				actor: {
					kind: row.actorKind,
					profileId: row.actorProfileId,
					profileName: row.actorName,
					credentialKind: row.actorCredentialKind,
					credentialId: row.actorCredentialId,
				},
				authority: { kind: row.authorityKind, id: row.authorityId },
				action: row.action,
				reasonCode: row.reasonCode,
				requestId: row.requestId,
				traceId: row.traceId,
				target: row.targetKind
					? {
							kind: row.targetKind,
							id: row.targetId,
							path: row.targetPath,
							name: row.targetName,
						}
					: null,
				details: row.details,
				createdAt: row.createdAt,
			})),
			nextCursor:
				hasNext && last
					? encodeAuditCursor({
							createdAt: last.createdAt.toISOString(),
							id: last.id,
						})
					: null,
		};
	},
	{
		access: "session-only",
		query: AuditEventsQuery,
		response: {
			[StatusCodes.OK]: AuditEventListResponse,
			[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
			[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
		},
		detail: { summary: "List global security audit events", tags: ["Audit"] },
	},
);
