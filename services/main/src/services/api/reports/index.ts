import { StatusCodes } from "http-status-codes";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import Elysia from "elysia";
import { OfficialRealmUnitIds } from "@rezics/slug";

import session from "../../auth/session";
import { getUnitReadCondition } from "../../authorization/unit/query";
import { database } from "../../database";
import {
	ActiveContentReviewCaseStateValues,
	GovernanceMaxRuleSources,
	ContentReviewReportCounterBuckets,
	type ContentLanguage,
	type ContentReviewCaseStateValues,
	contentGovernanceAction,
	contentReport,
	contentReportReferral,
	contentReportRule,
	contentReviewCase,
	contentReviewCaseReportCounter,
	realm,
	realmRule,
	realmRuleRevision,
	realmUnit,
	unit,
	unitLicenseGrant,
	unitRevisionHead,
} from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import {
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
} from "../../units/localization";
import {
	getPublicCanonicalUnitSlugAddresses,
	type PublicCanonicalUnitSlugAddress,
} from "../../units/slug-address";
import { currentRealmRuleRevisionReadLock } from "../../realms/rule-revision-lock";
import {
	getPlatformUnitModerationCommands,
	isActiveContentReviewCaseState,
} from "../governance/content-governance-contract";
import { toApiErrorResponse } from "../schema/response";
import {
	ReportAlreadySubmitted,
	ReportRealmMismatch,
	ReportRuleChanged,
	ReportRuleSourceForbidden,
	ReportRuleUnavailable,
	ReportTargetRevisionUnavailable,
} from "./errors";
import { contentReviewCaseAdvisoryLock, contentReviewReporterAdvisoryLock } from "./advisory-lock";
import {
	CreateReportBody,
	CreateReportQuery,
	ListMyReportsQuery,
	ListPlatformReportCasesQuery,
	ListRealmReportsQuery,
	ListReviewCaseReportsQuery,
	MyReportListResponse,
	type MyReportResponse,
	PlatformReportCaseListResponse,
	ReportDestinationsQuery,
	ReportDestinationsResponse,
	ReportListResponse,
	ReportRealmParams,
	ReportResponse,
	ReportUnitParams,
	ReviewCaseParams,
} from "./schema";
import {
	decodeMyReportCursor,
	encodeMyReportCursor,
	toAggregateMyReportStatus,
	toMyReportStatus,
} from "./my-report";

type LocalizationLanguages = Parameters<typeof resolvedUnitLocalizationLanguage>[1];
type ContentReviewCaseState = (typeof ContentReviewCaseStateValues)[number];

const reportSelection = {
	id: contentReport.id,
	reporterProfileId: contentReport.reporterProfileId,
	unitId: contentReport.targetUnitId,
	contextRealmId: contentReport.contextRealmId,
	details: contentReport.details,
	reportedRevisionId: contentReport.reportedRevisionId,
	createdAt: contentReport.createdAt,
};

type ReportRow = typeof contentReport.$inferSelect;
type ReportSelection = Pick<
	ReportRow,
	"id" | "reporterProfileId" | "contextRealmId" | "details" | "reportedRevisionId" | "createdAt"
> & { readonly unitId: string };

type HydratedReport = ReportSelection & {
	readonly rules: readonly {
		readonly id: string;
		readonly sourceRealmId: string;
		readonly revisionId: string;
		readonly language: ContentLanguage;
		readonly title: string;
	}[];
	readonly referrals: readonly {
		readonly id: string;
		readonly caseId: string;
		readonly scope: "platform" | "realm";
		readonly realmId: string | null;
		readonly caseState: ContentReviewCaseState;
		readonly destinationTitle: string | null;
	}[];
};

async function hydrateReports(
	rows: readonly ReportSelection[],
	localizationLanguages: LocalizationLanguages,
): Promise<HydratedReport[]> {
	if (!rows.length) return [];
	const reportIds = rows.map((row) => row.id);
	const [ruleRows, referralRows] = await Promise.all([
		database
			.select({
				reportId: contentReportRule.reportId,
				id: contentReportRule.ruleId,
				sourceRealmId: contentReportRule.ruleSourceRealmId,
				revisionId: contentReportRule.ruleRevisionId,
				language: resolvedUnitLocalizationLanguage(contentReportRule.ruleId, localizationLanguages),
				title: resolvedUnitLocalizationTitle(contentReportRule.ruleId, localizationLanguages),
			})
			.from(contentReportRule)
			.where(inArray(contentReportRule.reportId, reportIds))
			.orderBy(
				contentReportRule.reportId,
				contentReportRule.ruleSourceRealmId,
				contentReportRule.ruleId,
			),
		database
			.select({
				id: contentReportReferral.id,
				reportId: contentReportReferral.reportId,
				caseId: contentReportReferral.caseId,
				authority: contentReviewCase.authority,
				realmId: contentReviewCase.realmId,
				caseState: contentReviewCase.state,
				destinationTitle: resolvedUnitLocalizationTitle(
					contentReportReferral.ruleSourceRealmId,
					localizationLanguages,
				),
			})
			.from(contentReportReferral)
			.innerJoin(contentReviewCase, eq(contentReviewCase.id, contentReportReferral.caseId))
			.where(inArray(contentReportReferral.reportId, reportIds))
			.orderBy(contentReportReferral.reportId, contentReportReferral.ruleSourceRealmId),
	]);
	const rulesByReport = new Map<string, HydratedReport["rules"][number][]>();
	for (const rule of ruleRows) {
		if (!rule.language || !rule.title)
			throw new Error(`Report rule ${rule.id} has no localization`);
		const rules = rulesByReport.get(rule.reportId) ?? [];
		rules.push({ ...rule, language: rule.language, title: rule.title });
		rulesByReport.set(rule.reportId, rules);
	}
	const referralsByReport = new Map<string, HydratedReport["referrals"][number][]>();
	for (const referral of referralRows) {
		const referrals = referralsByReport.get(referral.reportId) ?? [];
		referrals.push({
			id: referral.id,
			caseId: referral.caseId,
			scope: referral.authority,
			realmId: referral.realmId,
			caseState: referral.caseState,
			destinationTitle: referral.destinationTitle,
		});
		referralsByReport.set(referral.reportId, referrals);
	}
	return rows.map((row) => {
		const rules = rulesByReport.get(row.id);
		const referrals = referralsByReport.get(row.id);
		if (!rules?.length || !referrals?.length)
			throw new Error(`Content report ${row.id} has an incomplete rule/referral graph`);
		return { ...row, rules, referrals };
	});
}

function presentReport(report: HydratedReport) {
	return {
		id: report.id,
		unitId: report.unitId,
		contextRealmId: report.contextRealmId,
		rules: report.rules.map((rule) => ({
			id: rule.id,
			sourceRealmId: rule.sourceRealmId,
			revisionId: rule.revisionId,
			language: rule.language,
			title: rule.title,
		})),
		referrals: report.referrals.map(
			({ destinationTitle: _destinationTitle, ...referral }) => referral,
		),
		details: report.details,
		reportedRevisionId: report.reportedRevisionId,
		createdAt: report.createdAt,
	};
}

async function listReadableReportTargets(
	unitIds: readonly string[],
	profileId: string,
	localizationLanguages: LocalizationLanguages,
) {
	if (!unitIds.length) return [];
	return database
		.select({
			id: unit.id,
			kind: unit.kind,
			language: resolvedUnitLocalizationLanguage(unit.id, localizationLanguages),
			title: resolvedUnitLocalizationTitle(unit.id, localizationLanguages),
		})
		.from(unit)
		.where(and(inArray(unit.id, [...new Set(unitIds)]), getUnitReadCondition(profileId)));
}

type ReadableReportTarget = Awaited<ReturnType<typeof listReadableReportTargets>>[number];

function presentMyReport(
	report: HydratedReport,
	target: ReadableReportTarget | undefined,
	slugAddress: PublicCanonicalUnitSlugAddress | null,
): MyReportResponse {
	const referrals = report.referrals.map((referral) => ({
		...referral,
		status: toMyReportStatus(referral.caseState),
	}));
	return {
		id: report.id,
		status: toAggregateMyReportStatus(report.referrals.map((referral) => referral.caseState)),
		target: target
			? { state: "available", unit: { ...target, slugAddress } }
			: { state: "unavailable" },
		rules: report.rules.map((rule) => ({
			id: rule.id,
			sourceRealmId: rule.sourceRealmId,
			revisionId: rule.revisionId,
			language: rule.language,
			title: rule.title,
		})),
		referrals,
		details: report.details,
		createdAt: report.createdAt,
	};
}

async function loadReportDestination(
	realmId: string,
	scope: "platform" | "realm",
	localizationLanguages: LocalizationLanguages,
) {
	const [[destination], [currentRevision]] = await Promise.all([
		database
			.select({
				id: realm.id,
				language: resolvedUnitLocalizationLanguage(realm.id, localizationLanguages),
				title: resolvedUnitLocalizationTitle(realm.id, localizationLanguages),
			})
			.from(realm)
			.where(eq(realm.id, realmId))
			.limit(1),
		database
			.select({ id: realmRuleRevision.id })
			.from(realmRuleRevision)
			.where(eq(realmRuleRevision.realmId, realmId))
			.orderBy(desc(realmRuleRevision.version))
			.limit(1),
	]);
	if (!destination || !destination.language || !currentRevision) return undefined;
	const rules = await database
		.select({
			id: realmRule.id,
			language: resolvedUnitLocalizationLanguage(realmRule.id, localizationLanguages),
			title: resolvedUnitLocalizationTitle(realmRule.id, localizationLanguages),
		})
		.from(realmRule)
		.where(eq(realmRule.revisionId, currentRevision.id))
		.orderBy(realmRule.position, realmRule.id)
		.limit(100);
	const presentedRules = rules.map((rule) => {
		if (!rule.language || !rule.title)
			throw new Error(`Report rule ${rule.id} has no localization`);
		return { id: rule.id, language: rule.language, title: rule.title };
	});
	if (!presentedRules.length) return undefined;
	return {
		...destination,
		language: destination.language,
		scope,
		revisionId: currentRevision.id,
		rules: presentedRules,
	};
}

function reportCursorCondition(cursor: ReturnType<typeof decodeMyReportCursor>) {
	return cursor
		? or(
				lt(contentReport.createdAt, cursor.createdAt),
				and(eq(contentReport.createdAt, cursor.createdAt), lt(contentReport.id, cursor.id)),
			)
		: undefined;
}

export default new Elysia().use(session).group("", (app) =>
	app
		.get(
			"/reports/me",
			async ({ profile, query }) => {
				const requestedReportId = query.reportId;
				const limit = requestedReportId ? 1 : (query.limit ?? 30);
				const cursor = requestedReportId ? undefined : decodeMyReportCursor(query.cursor);
				const rows = await database
					.select(reportSelection)
					.from(contentReport)
					.where(
						and(
							eq(contentReport.reporterProfileId, profile.unitId),
							requestedReportId ? eq(contentReport.id, requestedReportId) : undefined,
							reportCursorCondition(cursor),
						),
					)
					.orderBy(desc(contentReport.createdAt), desc(contentReport.id))
					.limit(limit + 1);
				const pageRows = rows.slice(0, limit);
				const reports = await hydrateReports(pageRows, query.localizationLanguages);
				const unitIds = reports.map((report) => report.unitId);
				const [targets, slugAddresses] = await Promise.all([
					listReadableReportTargets(unitIds, profile.unitId, query.localizationLanguages),
					getPublicCanonicalUnitSlugAddresses(unitIds),
				]);
				const targetById = new Map(targets.map((target) => [target.id, target]));
				const last = pageRows.at(-1);
				return {
					items: reports.map((report) =>
						presentMyReport(
							report,
							targetById.get(report.unitId),
							slugAddresses.get(report.unitId) ?? null,
						),
					),
					nextCursor:
						!requestedReportId && rows.length > limit && last
							? encodeMyReportCursor({ createdAt: last.createdAt, id: last.id })
							: null,
				};
			},
			{
				access: "report:write",
				query: ListMyReportsQuery,
				response: {
					[StatusCodes.OK]: MyReportListResponse,
					[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				},
				detail: { summary: "List current user's content reports", tags: ["Reports"] },
			},
		)
		.get(
			"/reports/units/:unitId/destinations",
			async ({ params, query, authorization }) => {
				await authorization.unit.ensureCanRead(params.unitId);
				if (query.contextRealmId) {
					await authorization.unit.ensureCanRead(
						query.contextRealmId,
						() => new UnitNotFound("Realm"),
					);
					const [membership] = await database
						.select({ unitId: realmUnit.unitId })
						.from(realmUnit)
						.where(
							and(eq(realmUnit.realmId, query.contextRealmId), eq(realmUnit.unitId, params.unitId)),
						)
						.limit(1);
					if (!membership) throw new ReportRealmMismatch();
				}
				const destinationRequests = [
					{ id: OfficialRealmUnitIds.rule, scope: "platform" as const },
					...(query.contextRealmId && query.contextRealmId !== OfficialRealmUnitIds.rule
						? [{ id: query.contextRealmId, scope: "realm" as const }]
						: []),
				];
				const items = (
					await Promise.all(
						destinationRequests.map((destination) =>
							loadReportDestination(destination.id, destination.scope, query.localizationLanguages),
						),
					)
				).filter((item) => item !== undefined);
				if (!items.some((item) => item.scope === "platform"))
					throw new Error("REZICS Rule bootstrap Realm is unavailable");
				return { items };
			},
			{
				access: "report:write",
				params: ReportUnitParams,
				query: ReportDestinationsQuery,
				response: {
					[StatusCodes.OK]: ReportDestinationsResponse,
					[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["ReportRealmMismatch"]),
					[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				},
				detail: {
					summary: "List the context and official rule sources for a content report",
					tags: ["Reports"],
				},
			},
		)
		.get(
			"/realms/:realmId/reports",
			async ({ params, query, authorization }) => {
				await authorization.realm.ensureCapability(params.realmId, "realm.units.moderate");
				const limit = query.limit ?? 50;
				const cursor = decodeMyReportCursor(query.cursor);
				const rows = await database
					.select({
						...reportSelection,
						referralCreatedAt: contentReportReferral.createdAt,
						referralId: contentReportReferral.id,
					})
					.from(contentReportReferral)
					.innerJoin(contentReviewCase, eq(contentReviewCase.id, contentReportReferral.caseId))
					.innerJoin(contentReport, eq(contentReport.id, contentReportReferral.reportId))
					.where(
						and(
							eq(contentReviewCase.authority, "realm"),
							eq(contentReviewCase.realmId, params.realmId),
							eq(contentReportReferral.ruleSourceRealmId, params.realmId),
							query.unitId ? eq(contentReviewCase.targetUnitId, query.unitId) : undefined,
							query.state ? eq(contentReviewCase.state, query.state) : undefined,
							cursor
								? or(
										lt(contentReportReferral.createdAt, cursor.createdAt),
										and(
											eq(contentReportReferral.createdAt, cursor.createdAt),
											lt(contentReportReferral.id, cursor.id),
										),
									)
								: undefined,
						),
					)
					.orderBy(desc(contentReportReferral.createdAt), desc(contentReportReferral.id))
					.limit(limit + 1);
				const page = rows.slice(0, limit);
				const reports = await hydrateReports(page, query.localizationLanguages);
				const last = page.at(-1);
				return {
					items: reports.map(presentReport),
					nextCursor:
						rows.length > limit && last
							? encodeMyReportCursor({
									createdAt: last.referralCreatedAt,
									id: last.referralId,
								})
							: null,
				};
			},
			{
				access: "session-only",
				params: ReportRealmParams,
				query: ListRealmReportsQuery,
				response: {
					[StatusCodes.OK]: ReportListResponse,
					[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
					[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
				},
				detail: { summary: "List content reports referred to a Realm", tags: ["Reports"] },
			},
		)
		.get(
			"/reports/review-cases/:caseId",
			async ({ params, query, authorization }) => {
				const [caseRow] = await database
					.select({
						id: contentReviewCase.id,
						authority: contentReviewCase.authority,
						realmId: contentReviewCase.realmId,
					})
					.from(contentReviewCase)
					.where(eq(contentReviewCase.id, params.caseId))
					.limit(1);
				if (!caseRow) return { items: [], nextCursor: null };
				if (caseRow.authority === "realm" && caseRow.realmId)
					await authorization.realm.ensureCapability(caseRow.realmId, "realm.units.moderate");
				else await authorization.platform.ensureCapability("platform.moderate");
				const limit = query.limit ?? 50;
				const cursor = decodeMyReportCursor(query.cursor);
				const rows = await database
					.select({
						...reportSelection,
						referralCreatedAt: contentReportReferral.createdAt,
						referralId: contentReportReferral.id,
					})
					.from(contentReportReferral)
					.innerJoin(contentReport, eq(contentReport.id, contentReportReferral.reportId))
					.where(
						and(
							eq(contentReportReferral.caseId, params.caseId),
							cursor
								? or(
										lt(contentReportReferral.createdAt, cursor.createdAt),
										and(
											eq(contentReportReferral.createdAt, cursor.createdAt),
											lt(contentReportReferral.id, cursor.id),
										),
									)
								: undefined,
						),
					)
					.orderBy(desc(contentReportReferral.createdAt), desc(contentReportReferral.id))
					.limit(limit + 1);
				const page = rows.slice(0, limit);
				const reports = await hydrateReports(page, query.localizationLanguages);
				const last = page.at(-1);
				return {
					items: reports.map(presentReport),
					nextCursor:
						rows.length > limit && last
							? encodeMyReportCursor({
									createdAt: last.referralCreatedAt,
									id: last.referralId,
								})
							: null,
				};
			},
			{
				access: "session-only",
				params: ReviewCaseParams,
				query: ListReviewCaseReportsQuery,
				response: {
					[StatusCodes.OK]: ReportListResponse,
					[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
					[StatusCodes.FORBIDDEN]: toApiErrorResponse([
						"RealmCapabilityRequired",
						"PlatformCapabilityRequired",
					]),
				},
				detail: { summary: "List reports in one content review case", tags: ["Reports"] },
			},
		)
		.get(
			"/reports/platform/cases",
			async ({ query, authorization }) => {
				await authorization.platform.ensureCapability("platform.moderate");
				const canManageLicenses = await authorization.platform.hasCapability("unit.license.manage");
				const limit = query.limit ?? 50;
				const cursor = decodeMyReportCursor(query.cursor);
				const rows = await database
					.select({
						caseId: contentReviewCase.id,
						caseState: contentReviewCase.state,
						unitId: unit.id,
						unitKind: unit.kind,
						language: resolvedUnitLocalizationLanguage(unit.id, query.localizationLanguages),
						title: resolvedUnitLocalizationTitle(unit.id, query.localizationLanguages),
						moderationStatus: unit.moderationStatus,
						postTargetingLocked: unit.postTargetingLocked,
						reportCount: sql<number>`coalesce((
							select sum(${contentReviewCaseReportCounter.count})::int
							from ${contentReviewCaseReportCounter}
							where ${contentReviewCaseReportCounter.caseId} = ${contentReviewCase.id}
						), 0)`,
						createdAt: contentReviewCase.createdAt,
						updatedAt: contentReviewCase.updatedAt,
					})
					.from(contentReviewCase)
					.innerJoin(unit, eq(unit.id, contentReviewCase.targetUnitId))
					.where(
						and(
							eq(contentReviewCase.authority, "platform"),
							query.state ? eq(contentReviewCase.state, query.state) : undefined,
							sql`exists (
								select 1 from ${contentReportReferral}
								where ${contentReportReferral.caseId} = ${contentReviewCase.id}
							)`,
							cursor
								? or(
										lt(contentReviewCase.updatedAt, cursor.createdAt),
										and(
											eq(contentReviewCase.updatedAt, cursor.createdAt),
											lt(contentReviewCase.id, cursor.id),
										),
									)
								: undefined,
						),
					)
					.orderBy(desc(contentReviewCase.updatedAt), desc(contentReviewCase.id))
					.limit(limit + 1);
				const page = rows.slice(0, limit);
				if (!page.length) return { items: [], nextCursor: null };
				const licenseGrantRows = await database
					.select({
						id: unitLicenseGrant.id,
						unitId: unitLicenseGrant.unitId,
						licenseId: unitLicenseGrant.licenseId,
						recognitionStatus: unitLicenseGrant.recognitionStatus,
						grantedAt: unitLicenseGrant.grantedAt,
					})
					.from(unitLicenseGrant)
					.where(
						and(
							inArray(
								unitLicenseGrant.unitId,
								page.map((row) => row.unitId),
							),
							isNull(unitLicenseGrant.offeringEndedAt),
						),
					)
					.orderBy(
						sql`${unitLicenseGrant.recognitionStatus} = 'recognized' desc`,
						desc(unitLicenseGrant.grantedAt),
						desc(unitLicenseGrant.id),
					);
				const grantsByUnit = new Map<string, (typeof licenseGrantRows)[number][]>();
				for (const grant of licenseGrantRows) {
					const existing = grantsByUnit.get(grant.unitId);
					if (existing) existing.push(grant);
					else grantsByUnit.set(grant.unitId, [grant]);
				}
				const invalidatedGrants = licenseGrantRows.filter(
					(grant) => grant.recognitionStatus === "invalidated",
				);
				const invalidationActions = invalidatedGrants.length
					? await database
							.select({
								id: contentGovernanceAction.id,
								licenseGrantId: contentGovernanceAction.licenseGrantId,
								createdAt: contentGovernanceAction.createdAt,
							})
							.from(contentGovernanceAction)
							.where(
								and(
									inArray(
										contentGovernanceAction.licenseGrantId,
										invalidatedGrants.map((grant) => grant.id),
									),
									eq(contentGovernanceAction.kind, "invalidate_license"),
									eq(contentGovernanceAction.resultingRecognitionStatus, "invalidated"),
								),
							)
							.orderBy(desc(contentGovernanceAction.createdAt), desc(contentGovernanceAction.id))
					: [];
				const invalidationActionByGrant = new Map<string, string>();
				for (const action of invalidationActions)
					if (action.licenseGrantId && !invalidationActionByGrant.has(action.licenseGrantId))
						invalidationActionByGrant.set(action.licenseGrantId, action.id);
				const last = page.at(-1);
				return {
					items: page.map((row) => {
						if (!row.language) throw new Error(`Reported Unit ${row.unitId} has no localization`);
						const grants = (grantsByUnit.get(row.unitId) ?? []).map((grant) =>
							grant.recognitionStatus === "invalidated"
								? {
										id: grant.id,
										licenseId: grant.licenseId,
										recognitionStatus: "invalidated" as const,
										offeringEnded: false as const,
										invalidationActionId:
											invalidationActionByGrant.get(grant.id) ??
											(() => {
												throw new Error(`Invalidated license grant ${grant.id} has no action`);
											})(),
									}
								: {
										id: grant.id,
										licenseId: grant.licenseId,
										recognitionStatus: "recognized" as const,
										offeringEnded: false as const,
									},
						);
						const hasOpenReports = isActiveContentReviewCaseState(row.caseState);
						return {
							...row,
							language: row.language,
							licenseGrants: grants,
							reportCount: Number(row.reportCount),
							allowedCommands: [
								...getPlatformUnitModerationCommands(
									row.moderationStatus,
									row.postTargetingLocked,
									canManageLicenses ? grants.map((grant) => grant.recognitionStatus) : [],
									hasOpenReports,
								),
							],
						};
					}),
					nextCursor:
						rows.length > limit && last
							? encodeMyReportCursor({ createdAt: last.updatedAt, id: last.caseId })
							: null,
				};
			},
			{
				access: "session-only",
				query: ListPlatformReportCasesQuery,
				response: {
					[StatusCodes.OK]: PlatformReportCaseListResponse,
					[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
					[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
				},
				detail: {
					summary: "List platform content review cases",
					tags: ["Reports"],
				},
			},
		)
		.post(
			"/reports/units/:unitId",
			async ({ params, body, query, profile, authorization }) => {
				const sourceRealmIds = [...new Set(body.rules.map((rule) => rule.sourceRealmId))].sort();
				if (sourceRealmIds.length > GovernanceMaxRuleSources) throw new ReportRuleSourceForbidden();
				const allowedSourceRealmIds = new Set([
					OfficialRealmUnitIds.rule,
					...(body.contextRealmId ? [body.contextRealmId] : []),
				]);
				if (
					sourceRealmIds.some((sourceRealmId) => !allowedSourceRealmIds.has(sourceRealmId)) ||
					new Set(body.rules.map((rule) => rule.ruleId)).size !== body.rules.length
				)
					throw new ReportRuleSourceForbidden();
				await Promise.all([
					authorization.unit.ensureCanRead(params.unitId),
					...sourceRealmIds.map((sourceRealmId) =>
						authorization.unit.ensureCanRead(sourceRealmId, () => new UnitNotFound("Realm")),
					),
				]);
				const details = body.details?.trim() || null;
				return database.transaction(async (tx) => {
					if (body.contextRealmId) {
						const [membership] = await tx
							.select({ unitId: realmUnit.unitId })
							.from(realmUnit)
							.where(
								and(
									eq(realmUnit.realmId, body.contextRealmId),
									eq(realmUnit.unitId, params.unitId),
								),
							)
							.for("key share")
							.limit(1);
						if (!membership) throw new ReportRealmMismatch();
					}
					for (const sourceRealmId of sourceRealmIds)
						await tx.execute(currentRealmRuleRevisionReadLock(sourceRealmId));
					const selectedRuleRows: Array<{
						id: string;
						sourceRealmId: string;
						revisionId: string;
						language: ContentLanguage;
						title: string;
					}> = [];
					for (const sourceRealmId of sourceRealmIds) {
						const sourceRules = body.rules.filter((rule) => rule.sourceRealmId === sourceRealmId);
						const [currentRevision] = await tx
							.select({ id: realmRuleRevision.id })
							.from(realmRuleRevision)
							.where(eq(realmRuleRevision.realmId, sourceRealmId))
							.orderBy(desc(realmRuleRevision.version))
							.limit(1);
						if (!currentRevision) throw new ReportRuleUnavailable();
						if (sourceRules.some((rule) => rule.revisionId !== currentRevision.id))
							throw new ReportRuleChanged();
						const selectedRules = await tx
							.select({
								id: realmRule.id,
								language: resolvedUnitLocalizationLanguage(
									realmRule.id,
									query.localizationLanguages,
								),
								title: resolvedUnitLocalizationTitle(realmRule.id, query.localizationLanguages),
							})
							.from(realmRule)
							.where(
								and(
									eq(realmRule.revisionId, currentRevision.id),
									inArray(
										realmRule.id,
										sourceRules.map((rule) => rule.ruleId),
									),
								),
							);
						if (selectedRules.length !== sourceRules.length) throw new ReportRuleChanged();
						for (const selectedRule of selectedRules) {
							if (!selectedRule.language || !selectedRule.title)
								throw new Error(`Report rule ${selectedRule.id} has no localization`);
							selectedRuleRows.push({
								id: selectedRule.id,
								sourceRealmId,
								revisionId: currentRevision.id,
								language: selectedRule.language,
								title: selectedRule.title,
							});
						}
					}
					const [target] = await tx
						.select({ revisionId: unitRevisionHead.revisionId })
						.from(unitRevisionHead)
						.where(eq(unitRevisionHead.unitId, params.unitId))
						.limit(1);
					if (!target) throw new ReportTargetRevisionUnavailable();

					const routes = sourceRealmIds
						.map((sourceRealmId) => ({
							sourceRealmId,
							authority:
								sourceRealmId === OfficialRealmUnitIds.rule
									? ("platform" as const)
									: ("realm" as const),
							realmId: sourceRealmId === OfficialRealmUnitIds.rule ? null : sourceRealmId,
						}))
						.sort((left, right) =>
							`${left.authority}:${left.realmId ?? ""}`.localeCompare(
								`${right.authority}:${right.realmId ?? ""}`,
							),
						);
					const [createdReport] = await tx
						.insert(contentReport)
						.values({
							reporterProfileId: profile.unitId,
							contextRealmId: body.contextRealmId,
							targetUnitId: params.unitId,
							details,
							reportedRevisionId: target.revisionId,
						})
						.returning(reportSelection);
					if (!createdReport) throw new Error("Content report insertion returned no row");
					await tx.insert(contentReportRule).values(
						selectedRuleRows.map((rule) => ({
							reportId: createdReport.id,
							ruleSourceRealmId: rule.sourceRealmId,
							ruleRevisionId: rule.revisionId,
							ruleId: rule.id,
						})),
					);

					const referrals: Array<{
						id: string;
						caseId: string;
						scope: "platform" | "realm";
						realmId: string | null;
						caseState: ContentReviewCaseState;
					}> = [];
					for (const route of routes) {
						const loadActiveCase = () =>
							tx
								.select({
									id: contentReviewCase.id,
									state: contentReviewCase.state,
								})
								.from(contentReviewCase)
								.where(
									and(
										eq(contentReviewCase.authority, route.authority),
										route.realmId ? eq(contentReviewCase.realmId, route.realmId) : undefined,
										eq(contentReviewCase.targetUnitId, params.unitId),
										inArray(contentReviewCase.state, ActiveContentReviewCaseStateValues),
									),
								)
								.orderBy(desc(contentReviewCase.updatedAt), desc(contentReviewCase.id))
								.limit(1)
								.for("share");
						let [caseRow] = await loadActiveCase();
						if (!caseRow) {
							await tx.execute(
								contentReviewCaseAdvisoryLock(route.authority, route.realmId, params.unitId),
							);
							[caseRow] = await loadActiveCase();
						}
						if (!caseRow) {
							[caseRow] = await tx
								.insert(contentReviewCase)
								.values({
									authority: route.authority,
									realmId: route.realmId,
									targetUnitId: params.unitId,
								})
								.returning({
									id: contentReviewCase.id,
									state: contentReviewCase.state,
								});
						}
						if (!caseRow) throw new Error("Content review case insertion returned no row");
						await tx.execute(contentReviewReporterAdvisoryLock(caseRow.id, profile.unitId));
						const [existing] = await tx
							.select({ id: contentReport.id })
							.from(contentReportReferral)
							.innerJoin(contentReport, eq(contentReport.id, contentReportReferral.reportId))
							.where(
								and(
									eq(contentReportReferral.caseId, caseRow.id),
									eq(contentReport.reporterProfileId, profile.unitId),
								),
							)
							.limit(1);
						if (existing) throw new ReportAlreadySubmitted();
						const [referral] = await tx
							.insert(contentReportReferral)
							.values({
								reportId: createdReport.id,
								caseId: caseRow.id,
								ruleSourceRealmId: route.sourceRealmId,
							})
							.returning({ id: contentReportReferral.id });
						if (!referral) throw new Error("Content report referral insertion returned no row");
						await tx
							.insert(contentReviewCaseReportCounter)
							.values({
								caseId: caseRow.id,
								bucket: sql<number>`mod((hashtextextended(${createdReport.id}::text, 0) & 2147483647), ${ContentReviewReportCounterBuckets})::smallint`,
								count: 1,
							})
							.onConflictDoUpdate({
								target: [
									contentReviewCaseReportCounter.caseId,
									contentReviewCaseReportCounter.bucket,
								],
								set: {
									count: sql`${contentReviewCaseReportCounter.count} + 1`,
								},
							});
						referrals.push({
							id: referral.id,
							caseId: caseRow.id,
							scope: route.authority,
							realmId: route.realmId,
							caseState: caseRow.state,
						});
					}
					return {
						id: createdReport.id,
						unitId: createdReport.unitId,
						contextRealmId: createdReport.contextRealmId,
						rules: selectedRuleRows,
						referrals,
						details: createdReport.details,
						reportedRevisionId: createdReport.reportedRevisionId,
						createdAt: createdReport.createdAt,
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
					[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
						"ReportRealmMismatch",
						"ReportRuleSourceForbidden",
					]),
					[StatusCodes.CONFLICT]: toApiErrorResponse([
						"ReportAlreadySubmitted",
						"ReportTargetRevisionUnavailable",
						"ReportRuleUnavailable",
						"ReportRuleChanged",
					]),
					[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				},
				detail: {
					summary: "Report content under selected current rules",
					tags: ["Reports"],
				},
			},
		),
);
