import { StatusCodes } from "http-status-codes";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import Elysia from "elysia";

import session from "../../auth/session";
import { database } from "../../database";
import {
	ActiveReportCaseStateValues,
	moderationCase,
	realm,
	realmUnit,
	report,
	unitRevisionHead,
} from "../../database/schema";
import {
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
} from "../../units/localization";
import { UnitNotFound } from "../../units/errors";
import { toApiErrorResponse } from "../schema/response";
import {
	ReportAlreadySubmitted,
	ReportRealmMismatch,
	ReportTargetRevisionUnavailable,
} from "./errors";
import {
	CreateReportBody,
	ListMyReportsQuery,
	ListRealmReportsQuery,
	ReportListResponse,
	ReportRealmOptionsQuery,
	ReportRealmOptionsResponse,
	ReportRealmParams,
	ReportResponse,
	ReportTargetParams,
	ReportUnitParams,
} from "./schema";

const reportSelection = {
	id: report.id,
	caseId: report.caseId,
	realmId: report.realmId,
	unitId: report.unitId,
	reason: report.reason,
	details: report.details,
	reportedRevisionId: report.reportedRevisionId,
	caseState: moderationCase.state,
	createdAt: report.createdAt,
};

export default new Elysia().use(session).group("", (app) =>
	app
		.get(
			"/reports/me",
			async ({ profile, query }) => {
				const items = await database
					.select(reportSelection)
					.from(report)
					.innerJoin(moderationCase, eq(moderationCase.id, report.caseId))
					.where(eq(report.reporterProfileId, profile.unitId))
					.orderBy(desc(report.createdAt), desc(report.id))
					.limit(query.limit ?? 30);
				return { items };
			},
			{
				access: "report:write",
				query: ListMyReportsQuery,
				response: { [StatusCodes.OK]: ReportListResponse },
				detail: { summary: "List current user's Unit reports", tags: ["Reports"] },
			},
		)
		.get(
			"/reports/units/:unitId/realms",
			async ({ params, query, authorization }) => {
				await authorization.unit.ensureCanRead(params.unitId);
				const rows = await database
					.select({
						id: realm.id,
						language: resolvedUnitLocalizationLanguage(
							realm.id,
							query.localizationLanguages,
						),
						title: resolvedUnitLocalizationTitle(realm.id, query.localizationLanguages),
					})
					.from(realmUnit)
					.innerJoin(realm, eq(realm.id, realmUnit.realmId))
					.where(eq(realmUnit.unitId, params.unitId))
					.orderBy(desc(realmUnit.updatedAt), desc(realm.id))
					.limit(query.limit ?? 100);
				const readableRows = (
					await Promise.all(
						rows.map(async (row) =>
							(await authorization.unit.canRead(row.id)) ? row : null,
						),
					)
				).filter((row) => row !== null);
				return {
					items: readableRows.map((row) => {
						if (!row.language)
							throw new Error(
								`Report destination Realm ${row.id} has no localization`,
							);
						return { ...row, language: row.language };
					}),
				};
			},
			{
				access: "report:write",
				params: ReportUnitParams,
				query: ReportRealmOptionsQuery,
				response: {
					[StatusCodes.OK]: ReportRealmOptionsResponse,
					[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				},
				detail: {
					summary: "List readable Realm report destinations for a Unit",
					tags: ["Reports"],
				},
			},
		)
		.get(
			"/realms/:realmId/reports",
			async ({ params, query, authorization }) => {
				await authorization.realm.ensureCapability(params.realmId, "realm.units.moderate");
				const items = await database
					.select(reportSelection)
					.from(report)
					.innerJoin(moderationCase, eq(moderationCase.id, report.caseId))
					.where(
						and(
							eq(report.realmId, params.realmId),
							query.unitId ? eq(report.unitId, query.unitId) : undefined,
							query.state ? eq(moderationCase.state, query.state) : undefined,
						),
					)
					.orderBy(desc(report.createdAt), desc(report.id))
					.limit(query.limit ?? 50);
				return { items };
			},
			{
				access: "session-only",
				params: ReportRealmParams,
				query: ListRealmReportsQuery,
				response: {
					[StatusCodes.OK]: ReportListResponse,
					[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
				},
				detail: { summary: "List reports for a Realm", tags: ["Reports"] },
			},
		)
		.post(
			"/realms/:realmId/units/:unitId/reports",
			async ({ params, body, profile, authorization }) => {
				await Promise.all([
					authorization.unit.ensureCanRead(params.unitId),
					authorization.unit.ensureCanRead(
						params.realmId,
						() => new UnitNotFound("Realm"),
					),
				]);
				const details = body.details?.trim() || null;
				return database.transaction(async (tx) => {
					await tx.execute(
						sql`select pg_advisory_xact_lock(hashtextextended(concat(${params.realmId}, ':', ${params.unitId}), 0))`,
					);
					const [target] = await tx
						.select({
							unitId: realmUnit.unitId,
							reportedRevisionId: unitRevisionHead.revisionId,
						})
						.from(realmUnit)
						.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, realmUnit.unitId))
						.where(
							and(
								eq(realmUnit.realmId, params.realmId),
								eq(realmUnit.unitId, params.unitId),
							),
						)
						.limit(1);
					if (!target) throw new ReportRealmMismatch();
					if (!target.reportedRevisionId) throw new ReportTargetRevisionUnavailable();

					let [activeCase] = await tx
						.select({ id: moderationCase.id, state: moderationCase.state })
						.from(moderationCase)
						.where(
							and(
								eq(moderationCase.authority, "realm"),
								eq(moderationCase.realmId, params.realmId),
								eq(moderationCase.targetKind, "realm_unit"),
								eq(moderationCase.targetId, params.unitId),
								inArray(moderationCase.state, ActiveReportCaseStateValues),
							),
						)
						.orderBy(desc(moderationCase.updatedAt), desc(moderationCase.id))
						.limit(1);
					if (activeCase) {
						const [existing] = await tx
							.select({ id: report.id })
							.from(report)
							.where(
								and(
									eq(report.caseId, activeCase.id),
									eq(report.reporterProfileId, profile.unitId),
								),
							)
							.limit(1);
						if (existing) throw new ReportAlreadySubmitted();
					} else {
						[activeCase] = await tx
							.insert(moderationCase)
							.values({
								authority: "realm",
								realmId: params.realmId,
								targetKind: "realm_unit",
								targetId: params.unitId,
							})
							.returning({ id: moderationCase.id, state: moderationCase.state });
					}
					if (!activeCase)
						throw new Error("Moderation case insertion did not return a row");

					const [created] = await tx
						.insert(report)
						.values({
							caseId: activeCase.id,
							reporterProfileId: profile.unitId,
							realmId: params.realmId,
							unitId: params.unitId,
							reason: body.reason,
							details,
							reportedRevisionId: target.reportedRevisionId,
						})
						.returning({
							id: report.id,
							caseId: report.caseId,
							realmId: report.realmId,
							unitId: report.unitId,
							reason: report.reason,
							details: report.details,
							reportedRevisionId: report.reportedRevisionId,
							createdAt: report.createdAt,
						});
					if (!created) throw new Error("Report insertion did not return a row");
					return { ...created, caseState: activeCase.state };
				});
			},
			{
				access: "write:report:write",
				params: ReportTargetParams,
				body: CreateReportBody,
				response: {
					[StatusCodes.OK]: ReportResponse,
					[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["ReportRealmMismatch"]),
					[StatusCodes.CONFLICT]: toApiErrorResponse([
						"ReportAlreadySubmitted",
						"ReportTargetRevisionUnavailable",
					]),
					[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				},
				detail: { summary: "Report a Unit to a Realm", tags: ["Reports"] },
			},
		),
);
