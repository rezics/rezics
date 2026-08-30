import { type Static, Type } from "typebox";

import { UnitReferencedBlockDocument } from "./blocks";
import { BlockKey, createBlockKey } from "./identity";

export const UnitPresentationTargetContractV0 = "rezics.unit.presentation@0" as const;
export const CustomThemeExecutionModeV0 = "host_full_trust" as const;

/**
 * Identifies the v0 external-live resource policy.
 *
 * @remarks
 * A future contract is intended to add REZICS-hosted executable and style
 * dependencies, but v0 neither implements nor accepts that state. Adding it
 * requires a separately approved design, schema, migration, and review model.
 *
 * @alpha
 */
export const CustomThemeResourceModeV0 = "external_live" as const;
export type CustomThemeResourceModeV0 = typeof CustomThemeResourceModeV0;

export const UnitPresentationFragmentSlotValues = ["header.append", "footer.append"] as const;
export type UnitPresentationFragmentSlot = (typeof UnitPresentationFragmentSlotValues)[number];

export const CustomThemeScriptRoleValues = ["classic_dependency", "module_entry"] as const;
export type CustomThemeScriptRole = (typeof CustomThemeScriptRoleValues)[number];

export const CustomThemeRevisionStateValues = [
	"pending_automated",
	"pending_human",
	"approved",
	"rejected",
	"killed",
	"revalidation_required",
] as const;
export type CustomThemeRevisionState = (typeof CustomThemeRevisionStateValues)[number];

export const CustomThemeRevisionFileRoleValues = [
	"manifest",
	"source_archive",
	"html",
	"css",
	"js",
	"worker",
	"wasm",
	"font",
	"svg",
	"asset",
] as const;
export type CustomThemeRevisionFileRole = (typeof CustomThemeRevisionFileRoleValues)[number];

export const CustomThemeExternalResourceHealthStateValues = [
	"current",
	"drifted",
	"unavailable",
	"unchecked",
] as const;
export type CustomThemeExternalResourceHealthState =
	(typeof CustomThemeExternalResourceHealthStateValues)[number];

export const MaximumCustomThemeScripts = 32;
export const MaximumCustomThemeStyles = 32;
export const MaximumCustomThemeDirectExternalResources = 128;
export const MaximumCustomThemeDiscoveredGraphNodes = 512;
export const MaximumCustomThemeInitialCodeBytes = 5 * 1_024 * 1_024;
export const MaximumCustomThemeFragmentBytes = 256 * 1_024;
export const MaximumCustomThemePackageBytes = 64 * 1_024 * 1_024;
export const MaximumCustomThemeResourceLoadMilliseconds = 10_000;
export const MaximumCustomThemeReferenceRenderScreenshotBytes = 10 * 1_024 * 1_024;

const HttpsUrl = Type.String({ minLength: 9, maxLength: 2_048, pattern: "^https://" });
const HttpsOrigin = Type.String({ minLength: 9, maxLength: 300, pattern: "^https://" });
const Sha256Hex = Type.String({ pattern: "^[0-9a-f]{64}$" });
const Uuid = Type.String({
	pattern:
		"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
});
const SriMetadata = Type.String({
	minLength: 1,
	maxLength: 500,
	pattern:
		"^(?:sha256|sha384|sha512)-[A-Za-z0-9+/]+={0,2}(?:\\s+(?:sha256|sha384|sha512)-[A-Za-z0-9+/]+={0,2})*$",
});

export const PackagedCustomThemeResourceReferenceV0 = Type.Object(
	{
		kind: Type.Literal("packaged"),
		path: Type.String({ minLength: 1, maxLength: 512 }),
	},
	{ additionalProperties: false },
);
export type PackagedCustomThemeResourceReferenceV0 = Static<
	typeof PackagedCustomThemeResourceReferenceV0
>;

export const SubmittedExternalLiveResourceReferenceV0 = Type.Union([
	PackagedCustomThemeResourceReferenceV0,
	Type.Object(
		{
			kind: Type.Literal("external"),
			url: HttpsUrl,
			integrity: Type.Optional(SriMetadata),
			integrityWaiverReason: Type.Optional(Type.String({ minLength: 1, maxLength: 2_000 })),
		},
		{ additionalProperties: false },
	),
]);
export type SubmittedExternalLiveResourceReferenceV0 = Static<
	typeof SubmittedExternalLiveResourceReferenceV0
>;

const SubmittedCustomThemeStyleV0 = Type.Object(
	{
		source: SubmittedExternalLiveResourceReferenceV0,
		media: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
		required: Type.Boolean(),
	},
	{ additionalProperties: false },
);

const SubmittedCustomThemeScriptV0 = Type.Object(
	{
		source: SubmittedExternalLiveResourceReferenceV0,
		role: Type.Union([Type.Literal("classic_dependency"), Type.Literal("module_entry")]),
		order: Type.Integer({ minimum: 0, maximum: MaximumCustomThemeScripts - 1 }),
		required: Type.Boolean(),
	},
	{ additionalProperties: false },
);

const RuntimeOriginInventoryV0 = Type.Object(
	{
		connect: Type.Array(HttpsOrigin, { maxItems: 32, uniqueItems: true }),
		image: Type.Array(HttpsOrigin, { maxItems: 32, uniqueItems: true }),
		font: Type.Array(HttpsOrigin, { maxItems: 32, uniqueItems: true }),
		frame: Type.Array(HttpsOrigin, { maxItems: 32, uniqueItems: true }),
		media: Type.Array(HttpsOrigin, { maxItems: 32, uniqueItems: true }),
	},
	{ additionalProperties: false },
);

/** A parsed author submission. It is not review evidence or executable authority. */
export const SubmittedCustomThemeManifestV0 = Type.Object(
	{
		schemaVersion: Type.Literal(0),
		targetContract: Type.Literal(UnitPresentationTargetContractV0),
		executionMode: Type.Literal(CustomThemeExecutionModeV0),
		resourceMode: Type.Literal(CustomThemeResourceModeV0),
		fragments: Type.Array(
			Type.Object(
				{
					slot: Type.Union([Type.Literal("header.append"), Type.Literal("footer.append")]),
					source: PackagedCustomThemeResourceReferenceV0,
				},
				{ additionalProperties: false },
			),
			{ maxItems: UnitPresentationFragmentSlotValues.length },
		),
		styles: Type.Array(SubmittedCustomThemeStyleV0, { maxItems: MaximumCustomThemeStyles }),
		scripts: Type.Array(SubmittedCustomThemeScriptV0, { maxItems: MaximumCustomThemeScripts }),
		declaredRuntimeOrigins: RuntimeOriginInventoryV0,
	},
	{ additionalProperties: false, $id: "SubmittedCustomThemeManifestV0" },
);
export type SubmittedCustomThemeManifestV0 = Static<typeof SubmittedCustomThemeManifestV0>;

/** Server-derived observation of one direct or transitively discovered remote resource. */
export const ReviewedExternalResourceV0 = Type.Object(
	{
		resourceKey: Type.String({ minLength: 1, maxLength: 200 }),
		role: Type.String({ minLength: 1, maxLength: 64 }),
		requestedUrl: HttpsUrl,
		finalUrl: HttpsUrl,
		redirectChain: Type.Array(HttpsUrl, { maxItems: 6 }),
		observedSha256: Sha256Hex,
		observedByteLength: Type.Integer({ minimum: 0, maximum: MaximumCustomThemeInitialCodeBytes }),
		observedContentType: Type.String({ minLength: 1, maxLength: 255 }),
		observedAt: Type.String({ format: "date-time" }),
		corsAllowsAnonymous: Type.Boolean(),
		required: Type.Boolean(),
		effectiveIntegrity: Type.Union([SriMetadata, Type.Null()]),
		integrityWaiverReason: Type.Union([
			Type.String({ minLength: 1, maxLength: 2_000 }),
			Type.Null(),
		]),
	},
	{ additionalProperties: false, $id: "ReviewedExternalResourceV0" },
);
export type ReviewedExternalResourceV0 = Static<typeof ReviewedExternalResourceV0>;

/** Immutable submitted manifest paired with server-derived review evidence. */
export const ReviewedCustomThemeManifestV0 = Type.Object(
	{
		manifest: SubmittedCustomThemeManifestV0,
		externalResources: Type.Array(ReviewedExternalResourceV0, {
			maxItems: MaximumCustomThemeDiscoveredGraphNodes,
		}),
		evidenceSha256: Sha256Hex,
	},
	{ additionalProperties: false, $id: "ReviewedCustomThemeManifestV0" },
);
export type ReviewedCustomThemeManifestV0 = Static<typeof ReviewedCustomThemeManifestV0>;

export const CustomThemeObservedRuntimeOriginsV0 = Type.Object(
	{
		connect: Type.Array(HttpsOrigin, { maxItems: 128, uniqueItems: true }),
		image: Type.Array(HttpsOrigin, { maxItems: 128, uniqueItems: true }),
		font: Type.Array(HttpsOrigin, { maxItems: 128, uniqueItems: true }),
		frame: Type.Array(HttpsOrigin, { maxItems: 128, uniqueItems: true }),
		media: Type.Array(HttpsOrigin, { maxItems: 128, uniqueItems: true }),
	},
	{ additionalProperties: false },
);
export type CustomThemeObservedRuntimeOriginsV0 = Static<
	typeof CustomThemeObservedRuntimeOriginsV0
>;

const CustomThemeReferenceRenderFixtureMetricPropertiesV0 = {
	viewport: Type.String({ minLength: 1, maxLength: 100 }),
	colorScheme: Type.Union([Type.Literal("light"), Type.Literal("dark")]),
	consoleErrorCount: Type.Integer({ minimum: 0 }),
	loadFailureCount: Type.Integer({ minimum: 0 }),
	layoutShift: Type.Number({ minimum: 0 }),
	largestContentfulPaintMilliseconds: Type.Number({ minimum: 0 }),
	interactionToNextPaintMilliseconds: Type.Number({ minimum: 0 }),
	longTaskMilliseconds: Type.Number({ minimum: 0 }),
	memoryBytes: Type.Integer({ minimum: 0 }),
	transferredBytes: Type.Integer({ minimum: 0 }),
	requestCount: Type.Integer({ minimum: 0 }),
} as const;

export const CustomThemeReferenceRenderEvidenceV0 = Type.Object(
	{
		rendererVersion: Type.String({ minLength: 1, maxLength: 100 }),
		observedRuntimeOrigins: CustomThemeObservedRuntimeOriginsV0,
		fixtures: Type.Array(
			Type.Object(
				{
					...CustomThemeReferenceRenderFixtureMetricPropertiesV0,
					screenshotAssetId: Uuid,
				},
				{ additionalProperties: false },
			),
			{ minItems: 2, maxItems: 24 },
		),
		accessibilityFindings: Type.Array(Type.String({ minLength: 1, maxLength: 1_000 }), {
			maxItems: 64,
		}),
		cleanupPassed: Type.Boolean(),
	},
	{ additionalProperties: false, $id: "CustomThemeReferenceRenderEvidenceV0" },
);
export type CustomThemeReferenceRenderEvidenceV0 = Static<
	typeof CustomThemeReferenceRenderEvidenceV0
>;

/** Authenticated internal request from the review worker to the browser renderer. */
export const CustomThemeReferenceRenderRequestV0 = Type.Object(
	{
		revisionId: Uuid,
		manifest: SubmittedCustomThemeManifestV0,
		packagedResources: Type.Array(
			Type.Object(
				{
					path: Type.String({ minLength: 1, maxLength: 512 }),
					url: HttpsUrl,
					sha256: Sha256Hex,
					contentType: Type.String({ minLength: 1, maxLength: 255 }),
				},
				{ additionalProperties: false },
			),
			{ maxItems: MaximumCustomThemeDiscoveredGraphNodes },
		),
		headerMarkup: Type.String({ maxLength: MaximumCustomThemeFragmentBytes }),
		footerMarkup: Type.String({ maxLength: MaximumCustomThemeFragmentBytes }),
		allowedOrigins: Type.Array(HttpsOrigin, { maxItems: 4_096, uniqueItems: true }),
	},
	{ additionalProperties: false, $id: "CustomThemeReferenceRenderRequestV0" },
);
export type CustomThemeReferenceRenderRequestV0 = Static<
	typeof CustomThemeReferenceRenderRequestV0
>;

/** Authenticated browser-run output before screenshots are persisted as review artifacts. */
export const CustomThemeReferenceRenderResultV0 = Type.Object(
	{
		rendererVersion: Type.String({ minLength: 1, maxLength: 100 }),
		observedRuntimeOrigins: CustomThemeObservedRuntimeOriginsV0,
		fixtures: Type.Array(
			Type.Object(
				{
					...CustomThemeReferenceRenderFixtureMetricPropertiesV0,
					screenshotBase64: Type.String({
						minLength: 1,
						maxLength: Math.ceil(MaximumCustomThemeReferenceRenderScreenshotBytes / 3) * 4,
					}),
				},
				{ additionalProperties: false },
			),
			{ minItems: 2, maxItems: 24 },
		),
		accessibilityFindings: Type.Array(Type.String({ minLength: 1, maxLength: 1_000 }), {
			maxItems: 64,
		}),
		cleanupPassed: Type.Boolean(),
	},
	{ additionalProperties: false, $id: "CustomThemeReferenceRenderResultV0" },
);
export type CustomThemeReferenceRenderResultV0 = Static<typeof CustomThemeReferenceRenderResultV0>;

export const CustomThemeHumanReviewEvidenceV0 = Type.Object(
	{
		owner: Type.String({ minLength: 1, maxLength: 500 }),
		incidentContact: Type.String({ minLength: 1, maxLength: 500 }),
		licenseFindings: Type.Array(Type.String({ minLength: 1, maxLength: 1_000 }), {
			maxItems: 64,
		}),
		acknowledgedRisks: Type.Array(Type.String({ minLength: 1, maxLength: 500 }), {
			minItems: 1,
			maxItems: 32,
		}),
	},
	{ additionalProperties: false, $id: "CustomThemeHumanReviewEvidenceV0" },
);
export type CustomThemeHumanReviewEvidenceV0 = Static<typeof CustomThemeHumanReviewEvidenceV0>;

export const UnitPresentationDocumentV0 = Type.Object(
	{
		_type: Type.Literal("unit-presentation-document"),
		_key: BlockKey,
		header: UnitReferencedBlockDocument,
		footer: UnitReferencedBlockDocument,
	},
	{ additionalProperties: false, $id: "UnitPresentationDocumentV0" },
);
export type UnitPresentationDocumentV0 = Static<typeof UnitPresentationDocumentV0>;

export function createUnitPresentationDocumentV0(
	input: Pick<UnitPresentationDocumentV0, "header" | "footer">,
	key: BlockKey = createBlockKey(),
): UnitPresentationDocumentV0 {
	return { _type: "unit-presentation-document", _key: key, ...input };
}

/**
 * Hosts an approved full-trust customization for a top-level Unit route.
 *
 * @remarks
 * Revision HTML, CSS, and JavaScript execute in the first-party REZICS
 * document without DOM, CSS, storage, network, or authenticated-request
 * isolation. Treat an enabled revision as deployed REZICS frontend code.
 *
 * The `external_live` resource mode may load CSS and JavaScript whose remote
 * bytes can change after review. Its approval covers the immutable manifest,
 * the review snapshot, the recorded host scope, and the capability-gated
 * preview audience; it does not prove an immutable transitive artifact
 * closure.
 *
 * A future contract is intended to replace live executable and style
 * dependencies with a REZICS-hosted immutable closure. This records design
 * direction only: v0 does not implement or persist such a mode, and this
 * comment is not a delivery commitment.
 *
 * Server-side capabilities are authoritative for submission, review,
 * installation, execution, and emergency revocation. Documentation tags do
 * not enforce access.
 *
 * V0 emits external-live resources only when the authenticated viewer has
 * both the common development-preview release gate and an active
 * `CustomThemeExternalLiveAccessCapability` grant. "Core trusted member" is
 * an admission and recertification policy, not a runtime authorization fact.
 *
 * Contract v0 supports top-level `zone` hosts only. The next intended host
 * adapter is top-level `zone_page`. Cards, lists, references, embedded Blocks,
 * and other nested Unit renderings never activate this customization.
 *
 * @alpha
 */
export interface UnitPresentationHostContractV0 {
	readonly targetContract: typeof UnitPresentationTargetContractV0;
	readonly hostKind: "zone";
	readonly activation: "top_level_route_host";
	readonly executionMode: typeof CustomThemeExecutionModeV0;
	readonly resourceMode: typeof CustomThemeResourceModeV0;
}
