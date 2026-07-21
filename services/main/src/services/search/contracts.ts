import { type Static, Type } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";
import {
	isPortableText,
	isPortableTextValueBlock,
	normalizePortableText,
} from "@rezics/portable-text";
import { PublicationLicenseIds } from "@rezics/license";

import type { SearchProjectionKind } from "../database/schema/search";

const Uuid = Type.String({
	pattern:
		"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
});
const NullableUuid = Type.Union([Uuid, Type.Null()]);
const NullableString = Type.Union([Type.String(), Type.Null()]);
const NullablePublicationLicense = Type.Union([
	Type.Union(PublicationLicenseIds.map((id) => Type.Literal(id))),
	Type.Null(),
]);
const NullableInteger = Type.Union([Type.Integer(), Type.Null()]);
const StringList = Type.Array(Type.String());
const UuidList = Type.Array(Uuid);

export const CurrentSearchProjectionVersion = 2 as const;
export const HistorySearchProjectionVersion = 1 as const;
export const SearchProjectionVersions = {
	current: CurrentSearchProjectionVersion,
	history: HistorySearchProjectionVersion,
} as const satisfies Record<SearchProjectionKind, number>;

export const CurrentSearchDocument = Type.Object(
	{
		id: Uuid,
		projectionVersion: Type.Literal(CurrentSearchProjectionVersion),
		revision: Type.Integer({ minimum: 1 }),
		category: Type.String(),
		unitType: Type.String(),
		subtype: NullableString,
		search: Type.Object({
			primaryTitles: StringList,
			titles: StringList,
			aliases: StringList,
			summaries: StringList,
			descriptions: StringList,
			publishedContent: StringList,
		}),
		languages: StringList,
		filters: Type.Object({
			contentRating: Type.String(),
			aiDisclosure: Type.String(),
			license: NullablePublicationLicense,
			tagIds: UuidList,
			realmIds: UuidList,
			publisherIds: UuidList,
			subjectId: NullableUuid,
			rootId: NullableUuid,
			parentId: NullableUuid,
			ownerId: NullableUuid,
			joinPolicy: NullableString,
			pollMode: NullableString,
			resultsVisibility: NullableString,
			closesAt: NullableInteger,
			scopeOwnerIds: UuidList,
		}),
		access: Type.Object({
			publicDiscoverable: Type.Boolean(),
			authenticated: Type.Boolean(),
			profileIds: UuidList,
			realmIds: UuidList,
		}),
		catalog: Type.Object({ licensed: Type.Boolean(), releaseAt: NullableInteger }),
		book: Type.Union([
			Type.Object({
				isbn13: NullableString,
				publicationAt: NullableInteger,
				pageCount: NullableInteger,
				format: NullableString,
			}),
			Type.Null(),
		]),
		media: Type.Union([
			Type.Object({
				kind: Type.String(),
				releaseAt: NullableInteger,
				runtimeMinutes: NullableInteger,
				episodeCount: NullableInteger,
				seasonCount: NullableInteger,
			}),
			Type.Null(),
		]),
		software: Type.Union([
			Type.Object({
				releaseAt: NullableInteger,
				versionLabel: NullableString,
				platformIds: UuidList,
				requirementTiers: StringList,
			}),
			Type.Null(),
		]),
		variant: Type.Object({
			role: Type.Union([
				Type.Literal("standalone"),
				Type.Literal("main"),
				Type.Literal("variant"),
			]),
			mainUnitId: NullableUuid,
		}),
		ranking: Type.Object({
			createdAt: Type.Integer(),
			updatedAt: Type.Integer(),
			publishedAt: NullableInteger,
			followerCount: Type.Integer({ minimum: 0 }),
			replyCount: Type.Integer({ minimum: 0 }),
			recommendationSnapshotId: NullableUuid,
			recommendationBest: Type.Number({ minimum: 0 }),
			engagement24h: Type.Number({ minimum: 0 }),
		}),
	},
	{ additionalProperties: false, $id: "CurrentSearchDocumentV2" },
);
export type CurrentSearchDocument = Static<typeof CurrentSearchDocument>;

export const RevisionSearchDocument = Type.Object(
	{
		id: Uuid,
		projectionVersion: Type.Literal(HistorySearchProjectionVersion),
		revision: Type.Integer({ minimum: 1 }),
		unitId: Uuid,
		parentRevisionId: NullableUuid,
		unitType: Type.String(),
		search: Type.Object({
			historicalTitles: StringList,
			editSummary: Type.String(),
			publicContent: StringList,
		}),
		filters: Type.Object({
			actorProfileId: NullableUuid,
			minor: Type.Boolean(),
			tags: StringList,
			createdAt: Type.Integer(),
		}),
		visibility: Type.Object({
			contentVisible: Type.Boolean(),
			summaryVisible: Type.Boolean(),
			actorVisible: Type.Boolean(),
		}),
	},
	{ additionalProperties: false, $id: "RevisionSearchDocumentV1" },
);
export type RevisionSearchDocument = Static<typeof RevisionSearchDocument>;

export function parseCurrentSearchDocument(value: unknown): CurrentSearchDocument {
	if (!Check(CurrentSearchDocument, value))
		throw new TypeError("Invalid current search document v2");
	if ((value.unitType === "book") !== (value.book !== null))
		throw new TypeError("Current search book applicability mismatch");
	if ((value.unitType === "media") !== (value.media !== null))
		throw new TypeError("Current search media applicability mismatch");
	if ((value.unitType === "software") !== (value.software !== null))
		throw new TypeError("Current search software applicability mismatch");
	return value;
}

export function parseRevisionSearchDocument(value: unknown): RevisionSearchDocument {
	if (!Check(RevisionSearchDocument, value))
		throw new TypeError("Invalid revision search document v1");
	if (
		(!value.visibility.contentVisible &&
			(value.search.historicalTitles.length > 0 || value.search.publicContent.length > 0)) ||
		(!value.visibility.summaryVisible && value.search.editSummary !== "") ||
		(!value.visibility.actorVisible && value.filters.actorProfileId !== null)
	)
		throw new TypeError("Hidden revision fields must be absent from the search document");
	return value;
}

/** Canonical allow-listed text extraction; arbitrary custom-block JSON is never indexed. */
export function extractCanonicalSearchText(value: unknown): string {
	const content =
		value !== null && typeof value === "object" && "_type" in value && "content" in value
			? value.content
			: value;
	if (!isPortableText(content)) return "";
	return normalizePortableText(content)
		.flatMap((block) =>
			isPortableTextValueBlock(block) ? block.children.map((child) => child.text) : [],
		)
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
}
