import { StatusCodes } from "http-status-codes";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import Elysia from "elysia";
import { OfficialRealmUnitIds } from "@rezics/slug";

import session from "../../auth/session";
import { database } from "../../database";
import {
	ActiveReportCaseStateValues,
	type ContentLanguage,
	type ModerationCaseStateValues,
	moderationCase,
	platformUnitReport,
	realm,
	realmRule,
	realmRuleRevision,
	realmUnit,
	realmUnitReport,
	unit,
	unitRevisionHead,
} from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import {
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
} from "../../units/localization";
import {
	getPlatformUnitModerationCommands,
	isActiveReportCaseState,
} from "../governance/moderation-contract";
import { toApiErrorResponse } from "../schema/response";
import {
	ReportAlreadySubmitted,
	ReportRealmMismatch,
	ReportRuleChanged,
	ReportRuleUnavailable,
	ReportTargetRevisionUnavailable,
} from "./errors";
import {
	platformUnitReportCaseAdvisoryLock,
	realmUnitReportCaseAdvisoryLock,
} from "./advisory-lock";
import {
	CreateReportBody,
	CreateReportQuery,
	ListMyReportsQuery,
	ListPlatformReportCasesQuery,
	ListRealmReportsQuery,
	PlatformReportCaseListResponse,
	ReportDestinationsQuery,
	ReportDestinationsResponse,
	ReportListResponse,
	ReportRealmParams,
	ReportResponse,
	ReportUnitParams,
} from "./schema";

type LocalizationLanguages = Parameters<typeof resolvedUnitLocalizationLanguage>[1];
type ModerationCaseState = (typeof ModerationCaseStateValues)[number];

const realmReportSelection = (localizationLanguages: LocalizationLanguages) => ({
	id: realmUnitReport.id,
	caseId: realmUnitReport.caseId,
	scope: sql<"realm">`'realm'`,
	realmId: realmUnitReport.realmId,
	unitId: realmUnitReport.unitId,
	ruleId: realmUnitReport.ruleId,
	ruleRevisionId: realmUnitReport.ruleRevisionId,
	ruleLanguage: resolvedUnitLocalizationLanguage(realmUnitReport.ruleId, localizationLanguages),
	ruleTitle: resolvedUnitLocalizationTitle(realmUnitReport.ruleId, localizationLanguages),
	details: realmUnitReport.details,
	reportedRevisionId: realmUnitReport.reportedRevisionId,
	caseState: moderationCase.state,
	createdAt: realmUnitReport.createdAt,
});

const platformReportSelection = (localizationLanguages: LocalizationLanguages) => ({
	id: platformUnitReport.id,
	caseId: platformUnitReport.caseId,
	scope: sql<"platform">`'platform'`,
	ruleSourceRealmId: platformUnitReport.ruleSourceRealmId,
	unitId: platformUnitReport.unitId,
	ruleId: platformUnitReport.ruleId,
	ruleRevisionId: platformUnitReport.ruleRevisionId,
	ruleLanguage: resolvedUnitLocalizationLanguage(
		platformUnitReport.ruleId,
		localizationLanguages,
	),
	ruleTitle: resolvedUnitLocalizationTitle(platformUnitReport.ruleId, localizationLanguages),
	details: platformUnitReport.details,
	reportedRevisionId: platformUnitReport.reportedRevisionId,
	caseState: moderationCase.state,
	createdAt: platformUnitReport.createdAt,
});

function presentRealmReport(row: {
	readonly id: string;
	readonly caseId: string;
	readonly realmId: string;
	readonly unitId: string;
	readonly ruleId: string;
	readonly ruleRevisionId: string;
	readonly ruleLanguage: ContentLanguage | null;
	readonly ruleTitle: string | null;
	readonly details: string | null;
	readonly reportedRevisionId: string;
	readonly caseState: ModerationCaseState;
	readonly createdAt: Date;
}) {
	if (!row.ruleLanguage || !row.ruleTitle)
		throw new Error(`Report rule ${row.ruleId} has no localization`);
	return {
		id: row.id,
		caseId: row.caseId,
		scope: "realm" as const,
		realmId: row.realmId,
		unitId: row.unitId,
		rule: {
			id: row.ruleId,
			revisionId: row.ruleRevisionId,
			language: row.ruleLanguage,
			title: row.ruleTitle,
		},
		details: row.details,
		reportedRevisionId: row.reportedRevisionId,
		caseState: row.caseState,
		createdAt: row.createdAt,
	};
}

function presentPlatformReport(row: {
	readonly id: string;
	readonly caseId: string;
	readonly ruleSourceRealmId: string;
	readonly unitId: string;
	readonly ruleId: string;
	readonly ruleRevisionId: string;
	readonly ruleLanguage: ContentLanguage | null;
	readonly ruleTitle: string | null;
	readonly details: string | null;
	readonly reportedRevisionId: string;
	readonly caseState: ModerationCaseState;
	readonly createdAt: Date;
}) {
	if (!row.ruleLanguage || !row.ruleTitle)
		throw new Error(`Report rule ${row.ruleId} has no localization`);
	return {
		id: row.id,
		caseId: row.caseId,
		scope: "platform" as const,
		ruleSourceRealmId: row.ruleSourceRealmId,
		unitId: row.unitId,
		rule: {
			id: row.ruleId,
			revisionId: row.ruleRevisionId,
			language: row.ruleLanguage,
			title: row.ruleTitle,
		},
		details: row.details,
		reportedRevisionId: row.reportedRevisionId,
		caseState: row.caseState,
		createdAt: row.createdAt,
	};
}

async function hasCurrentRules(realmId: string): Promise<boolean> {
	const [current] = await database
		.select({ id: realmRuleRevision.id })
		.from(realmRuleRevision)
		.where(eq(realmRuleRevision.realmId, realmId))
		.orderBy(desc(realmRuleRevision.version))
		.limit(1);
	if (!current) return false;
	const [rule] = await database
		.select({ id: realmRule.id })
		.from(realmRule)
		.where(eq(realmRule.revisionId, current.id))
		.limit(1);
	return Boolean(rule);
}

export default new Elysia().use(session).group("", (app) =>
	app
		.get(
			"/reports/me",
			async ({ profile, query }) => {
				const limit = query.limit ?? 50;
				const [realmRows, platformRows] = await Promise.all([
					database
						.select(realmReportSelection(query.localizationLanguages))
						.from(realmUnitReport)
						.innerJoin(moderationCase, eq(moderationCase.id, realmUnitReport.caseId))
						.where(eq(realmUnitReport.reporterProfileId, profile.unitId))
						.orderBy(desc(realmUnitReport.createdAt), desc(realmUnitReport.id))
						.limit(limit),
					database
						.select(platformReportSelection(query.localizationLanguages))
						.from(platformUnitReport)
						.innerJoin(moderationCase, eq(moderationCase.id, platformUnitReport.caseId))
						.where(eq(platformUnitReport.reporterProfileId, profile.unitId))
						.orderBy(desc(platformUnitReport.createdAt), desc(platformUnitReport.id))
						.limit(limit),
				]);
				const items = [
					...realmRows.map(presentRealmReport),
					...platformRows.map(presentPlatformReport),
				]
					.sort(
						(left, right) =>
							right.createdAt.getTime() - left.createdAt.getTime() ||
							right.id.localeCompare(left.id),
					)
					.slice(0, limit);
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
			"/reports/units/:unitId/destinations",
			async ({ params, query, authorization }) => {
				await authorization.unit.ensureCanRead(params.unitId);
				const [platformDestination, realmRows] = await Promise.all([
					database
						.select({
							id: realm.id,
							language: resolvedUnitLocalizationLanguage(
								realm.id,
								query.localizationLanguages,
							),
							title: resolvedUnitLocalizationTitle(
								realm.id,
								query.localizationLanguages,
							),
						})
						.from(realm)
						.where(eq(realm.id, OfficialRealmUnitIds.rule))
						.limit(1),
					database
						.select({
							id: realm.id,
							language: resolvedUnitLocalizationLanguage(
								realm.id,
								query.localizationLanguages,
							),
							title: resolvedUnitLocalizationTitle(
								realm.id,
								query.localizationLanguages,
							),
							updatedAt: realmUnit.updatedAt,
						})
						.from(realmUnit)
						.innerJoin(realm, eq(realm.id, realmUnit.realmId))
						.where(
							and(
								eq(realmUnit.unitId, params.unitId),
								sql`${realm.id} <> ${OfficialRealmUnitIds.rule}::uuid`,
							),
						)
						.orderBy(desc(realmUnit.updatedAt), desc(realm.id))
						.limit(query.limit ?? 100),
				]);
				const global = platformDestination[0];
				if (!global || !(await hasCurrentRules(global.id)))
					throw new Error("REZICS Rule bootstrap Realm is unavailable");
				if (!global.language)
					throw new Error("REZICS Rule bootstrap Realm has no localization");
				const readableRealmRows = (
					await Promise.all(
						realmRows.map(async (row) =>
							(await authorization.unit.canRead(row.id)) &&
							(await hasCurrentRules(row.id))
								? row
								: null,
						),
					)
				).filter((row) => row !== null);
				return {
					items: [
						{
							id: global.id,
							language: global.language,
							title: global.title,
							scope: "platform" as const,
						},
						...readableRealmRows.map(({ updatedAt: _updatedAt, ...row }) => {
							if (!row.language)
								throw new Error(
									`Report destination Realm ${row.id} has no localization`,
								);
							return {
								...row,
								language: row.language,
								scope: "realm" as const,
							};
						}),
					],
				};
			},
			{
				access: "report:write",
				params: ReportUnitParams,
				query: ReportDestinationsQuery,
				response: {
					[StatusCodes.OK]: ReportDestinationsResponse,
					[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				},
				detail: {
					summary: "List rule Realms that can receive a Unit report",
					tags: ["Reports"],
				},
			},
		)
		.get(
			"/realms/:realmId/reports",
			async ({ params, query, authorization }) => {
				await authorization.realm.ensureCapability(params.realmId, "realm.units.moderate");
				const rows = await database
					.select(realmReportSelection(query.localizationLanguages))
					.from(realmUnitReport)
					.innerJoin(moderationCase, eq(moderationCase.id, realmUnitReport.caseId))
					.where(
						and(
							eq(realmUnitReport.realmId, params.realmId),
							query.unitId ? eq(realmUnitReport.unitId, query.unitId) : undefined,
							query.state ? eq(moderationCase.state, query.state) : undefined,
						),
					)
					.orderBy(desc(realmUnitReport.createdAt), desc(realmUnitReport.id))
					.limit(query.limit ?? 50);
				return { items: rows.map(presentRealmReport) };
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
		.get(
			"/reports/platform/cases",
			async ({ query, authorization }) => {
				await authorization.platform.ensureCapability("platform.moderate");
				const rows = await database
					.selectDistinct({
						caseId: moderationCase.id,
						caseState: moderationCase.state,
						unitId: unit.id,
						unitKind: unit.kind,
						language: resolvedUnitLocalizationLanguage(
							unit.id,
							query.localizationLanguages,
						),
						title: resolvedUnitLocalizationTitle(unit.id, query.localizationLanguages),
						moderationStatus: unit.moderationStatus,
						postTargetingLocked: unit.postTargetingLocked,
						createdAt: moderationCase.createdAt,
						updatedAt: moderationCase.updatedAt,
					})
					.from(moderationCase)
					.innerJoin(platformUnitReport, eq(platformUnitReport.caseId, moderationCase.id))
					.innerJoin(unit, eq(unit.id, moderationCase.targetId))
					.where(
						and(
							eq(moderationCase.authority, "platform"),
							eq(moderationCase.targetKind, "unit"),
							query.state ? eq(moderationCase.state, query.state) : undefined,
						),
					)
					.orderBy(desc(moderationCase.updatedAt), desc(moderationCase.id))
					.limit(query.limit ?? 50);
				if (rows.length === 0) return { items: [] };
				const reportRows = await database
					.select(platformReportSelection(query.localizationLanguages))
					.from(platformUnitReport)
					.innerJoin(moderationCase, eq(moderationCase.id, platformUnitReport.caseId))
					.where(
						inArray(
							platformUnitReport.caseId,
							rows.map((row) => row.caseId),
						),
					)
					.orderBy(desc(platformUnitReport.createdAt), desc(platformUnitReport.id));
				const reportsByCase = new Map<string, ReturnType<typeof presentPlatformReport>[]>();
				for (const reportRow of reportRows) {
					const presented = presentPlatformReport(reportRow);
					const reports = reportsByCase.get(reportRow.caseId) ?? [];
					reports.push(presented);
					reportsByCase.set(reportRow.caseId, reports);
				}
				return {
					items: rows.map((row) => {
						if (!row.language)
							throw new Error(`Reported Unit ${row.unitId} has no localization`);
						const reports = reportsByCase.get(row.caseId);
						if (!reports?.length)
							throw new Error(`Platform report case ${row.caseId} has no reports`);
						const hasOpenReports = isActiveReportCaseState(row.caseState);
						return {
							...row,
							language: row.language,
							openReportCount: hasOpenReports ? reports.length : 0,
							allowedCommands: [
								...getPlatformUnitModerationCommands(
									row.moderationStatus,
									row.postTargetingLocked,
									hasOpenReports,
								),
							],
							reports,
						};
					}),
				};
			},
			{
				access: "session-only",
				query: ListPlatformReportCasesQuery,
				response: {
					[StatusCodes.OK]: PlatformReportCaseListResponse,
					[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
				},
				detail: {
					summary: "List platform-governed Unit report cases",
					tags: ["Reports"],
				},
			},
		)
		.post(
			"/reports/units/:unitId",
			async ({ params, body, query, profile, authorization }) => {
				await Promise.all([
					authorization.unit.ensureCanRead(params.unitId),
					authorization.unit.ensureCanRead(
						body.ruleRealmId,
						() => new UnitNotFound("Realm"),
					),
				]);
				const details = body.details?.trim() || null;
				return database.transaction(async (tx) => {
					await tx.execute(
						sql`select pg_advisory_xact_lock(hashtextextended(${body.ruleRealmId}::text, 0))`,
					);
					const [currentRuleRevision] = await tx
						.select({ id: realmRuleRevision.id })
						.from(realmRuleRevision)
						.where(eq(realmRuleRevision.realmId, body.ruleRealmId))
						.orderBy(desc(realmRuleRevision.version))
						.limit(1);
					if (!currentRuleRevision) throw new ReportRuleUnavailable();
					const [selectedRule] = await tx
						.select({
							id: realmRule.id,
							revisionId: realmRule.revisionId,
							language: resolvedUnitLocalizationLanguage(
								realmRule.id,
								query.localizationLanguages,
							),
							title: resolvedUnitLocalizationTitle(
								realmRule.id,
								query.localizationLanguages,
							),
						})
						.from(realmRule)
						.where(
							and(
								eq(realmRule.id, body.ruleId),
								eq(realmRule.revisionId, currentRuleRevision.id),
							),
						)
						.limit(1);
					if (!selectedRule) throw new ReportRuleChanged();
					if (!selectedRule.language || !selectedRule.title)
						throw new Error(`Report rule ${selectedRule.id} has no localization`);

					const [target] = await tx
						.select({
							unitId: unitRevisionHead.unitId,
							reportedRevisionId: unitRevisionHead.revisionId,
						})
						.from(unitRevisionHead)
						.where(eq(unitRevisionHead.unitId, params.unitId))
						.limit(1);
					if (!target) throw new ReportTargetRevisionUnavailable();
					const rule = {
						id: selectedRule.id,
						revisionId: selectedRule.revisionId,
						language: selectedRule.language,
						title: selectedRule.title,
					};

					if (body.ruleRealmId === OfficialRealmUnitIds.rule) {
						await tx.execute(platformUnitReportCaseAdvisoryLock(params.unitId));
						let [activeCase] = await tx
							.select({ id: moderationCase.id, state: moderationCase.state })
							.from(moderationCase)
							.where(
								and(
									eq(moderationCase.authority, "platform"),
									eq(moderationCase.targetKind, "unit"),
									eq(moderationCase.targetId, params.unitId),
									inArray(moderationCase.state, ActiveReportCaseStateValues),
								),
							)
							.orderBy(desc(moderationCase.updatedAt), desc(moderationCase.id))
							.limit(1);
						if (activeCase) {
							const [existing] = await tx
								.select({ id: platformUnitReport.id })
								.from(platformUnitReport)
								.where(
									and(
										eq(platformUnitReport.caseId, activeCase.id),
										eq(platformUnitReport.reporterProfileId, profile.unitId),
									),
								)
								.limit(1);
							if (existing) throw new ReportAlreadySubmitted();
						} else {
							[activeCase] = await tx
								.insert(moderationCase)
								.values({
									authority: "platform",
									targetKind: "unit",
									targetId: params.unitId,
								})
								.returning({
									id: moderationCase.id,
									state: moderationCase.state,
								});
						}
						if (!activeCase)
							throw new Error("Moderation case insertion did not return a row");
						const [created] = await tx
							.insert(platformUnitReport)
							.values({
								caseId: activeCase.id,
								reporterProfileId: profile.unitId,
								unitId: params.unitId,
								ruleSourceRealmId: body.ruleRealmId,
								ruleRevisionId: selectedRule.revisionId,
								ruleId: selectedRule.id,
								details,
								reportedRevisionId: target.reportedRevisionId,
							})
							.returning({
								id: platformUnitReport.id,
								caseId: platformUnitReport.caseId,
								unitId: platformUnitReport.unitId,
								ruleSourceRealmId: platformUnitReport.ruleSourceRealmId,
								details: platformUnitReport.details,
								reportedRevisionId: platformUnitReport.reportedRevisionId,
								createdAt: platformUnitReport.createdAt,
							});
						if (!created)
							throw new Error("Platform report insertion did not return a row");
						return {
							...created,
							scope: "platform" as const,
							rule,
							caseState: activeCase.state,
						};
					}

					await tx.execute(
						realmUnitReportCaseAdvisoryLock(body.ruleRealmId, params.unitId),
					);
					const [membership] = await tx
						.select({ unitId: realmUnit.unitId })
						.from(realmUnit)
						.where(
							and(
								eq(realmUnit.realmId, body.ruleRealmId),
								eq(realmUnit.unitId, params.unitId),
							),
						)
						.limit(1);
					if (!membership) throw new ReportRealmMismatch();
					let [activeCase] = await tx
						.select({ id: moderationCase.id, state: moderationCase.state })
						.from(moderationCase)
						.where(
							and(
								eq(moderationCase.authority, "realm"),
								eq(moderationCase.realmId, body.ruleRealmId),
								eq(moderationCase.targetKind, "realm_unit"),
								eq(moderationCase.targetId, params.unitId),
								inArray(moderationCase.state, ActiveReportCaseStateValues),
							),
						)
						.orderBy(desc(moderationCase.updatedAt), desc(moderationCase.id))
						.limit(1);
					if (activeCase) {
						const [existing] = await tx
							.select({ id: realmUnitReport.id })
							.from(realmUnitReport)
							.where(
								and(
									eq(realmUnitReport.caseId, activeCase.id),
									eq(realmUnitReport.reporterProfileId, profile.unitId),
								),
							)
							.limit(1);
						if (existing) throw new ReportAlreadySubmitted();
					} else {
						[activeCase] = await tx
							.insert(moderationCase)
							.values({
								authority: "realm",
								realmId: body.ruleRealmId,
								targetKind: "realm_unit",
								targetId: params.unitId,
							})
							.returning({
								id: moderationCase.id,
								state: moderationCase.state,
							});
					}
					if (!activeCase)
						throw new Error("Moderation case insertion did not return a row");
					const [created] = await tx
						.insert(realmUnitReport)
						.values({
							caseId: activeCase.id,
							reporterProfileId: profile.unitId,
							realmId: body.ruleRealmId,
							unitId: params.unitId,
							ruleRevisionId: selectedRule.revisionId,
							ruleId: selectedRule.id,
							details,
							reportedRevisionId: target.reportedRevisionId,
						})
						.returning({
							id: realmUnitReport.id,
							caseId: realmUnitReport.caseId,
							realmId: realmUnitReport.realmId,
							unitId: realmUnitReport.unitId,
							details: realmUnitReport.details,
							reportedRevisionId: realmUnitReport.reportedRevisionId,
							createdAt: realmUnitReport.createdAt,
						});
					if (!created) throw new Error("Realm report insertion did not return a row");
					return {
						...created,
						scope: "realm" as const,
						rule,
						caseState: activeCase.state,
					};
				});
			},
			{
				access: "write:report:write",
				params: ReportUnitParams,
				query: CreateReportQuery,
				body: CreateReportBody,
				response: {
					[StatusCodes.OK]: ReportResponse,
					[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["ReportRealmMismatch"]),
					[StatusCodes.CONFLICT]: toApiErrorResponse([
						"ReportAlreadySubmitted",
						"ReportTargetRevisionUnavailable",
						"ReportRuleUnavailable",
						"ReportRuleChanged",
					]),
					[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				},
				detail: { summary: "Report a Unit under a selected Realm rule", tags: ["Reports"] },
			},
		),
);
