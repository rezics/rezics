import {
	DockDocument,
	NavigationDocument,
	PortableTextDocument,
	UnitReferencedBlockDocument,
	ZoneAppearanceDocument,
} from "@rezics/block";
import { FilterDocument } from "@rezics/filter";
import { type StaticDecode, Type } from "typebox";
import { t } from "elysia";

import {
	DateTime,
	FractionalPosition,
	FractionalPositionInput,
	ContentLanguage,
	LocalizationLanguageQuery,
	RevisionContext,
	UnitLocalizationInput,
	Uuid,
} from "../schema";
import { AvatarResponse, ImageAssetResponse } from "../schema/response";
import { NullablePublicSlugAddressResponse, SlugLabelInput } from "../slug-addresses/schema";
import { ResolvedUnitPresentationResponse } from "../custom-themes/schema";

// TypeBox 1 recursive schemas carry their own definitions. Keeping them opaque
// at the adapter boundary prevents recursive static types from expanding through
// the entire Elysia route chain without relying on a global model registry.
const FilterResponseDocument = Type.Unsafe<unknown>(FilterDocument);
const ZoneThemeResponseDocument = Type.Unsafe<unknown>(ZoneAppearanceDocument);
const UnitReferencedBlockResponseDocument = Type.Unsafe<unknown>(UnitReferencedBlockDocument);
const NavigationResponseDocument = Type.Unsafe<unknown>(NavigationDocument);
const DockResponseDocument = Type.Unsafe<unknown>(DockDocument);
const PortableTextResponseDocument = Type.Unsafe<unknown>(PortableTextDocument);
const ResolvedUnitPresentationResponseDocument = Type.Unsafe<unknown>(
	ResolvedUnitPresentationResponse,
);
const FilterInputDocument = Type.Unsafe<StaticDecode<typeof FilterDocument>>(FilterDocument);
const ZoneThemeInputDocument =
	Type.Unsafe<StaticDecode<typeof ZoneAppearanceDocument>>(ZoneAppearanceDocument);
const UnitReferencedBlockInputDocument = Type.Unsafe<
	StaticDecode<typeof UnitReferencedBlockDocument>
>(UnitReferencedBlockDocument);
const NavigationInputDocument =
	Type.Unsafe<StaticDecode<typeof NavigationDocument>>(NavigationDocument);

export const CreateZoneBody = t.Object(
	{
		localization: UnitLocalizationInput,
		filterDocument: FilterInputDocument,
		appearanceDocument: ZoneThemeInputDocument,
		startsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
		endsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
		localRuleRealmId: t.Optional(t.Nullable(Uuid)),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export const ZoneParams = t.Object({ zoneId: Uuid });
export const ZoneDetailQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export const ZoneRenderQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		safeMode: t.Optional(t.Boolean({ default: false })),
		page: t.Optional(
			t.String({ minLength: 1, maxLength: 100, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
		),
		pageId: t.Optional(Uuid),
		postId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);
export const ZonePageIdParams = t.Object({ zoneId: Uuid, pageId: Uuid });
export const ZonePageSlugParams = t.Object({ zoneId: Uuid, slug: SlugLabelInput });
export const ZonePageAddressResponse = t.Object(
	{
		id: Uuid,
		zoneId: Uuid,
		slug: t.Nullable(SlugLabelInput),
		redirected: t.Boolean(),
	},
	{ additionalProperties: false },
);
export const ZoneNavigationParams = t.Object({
	zoneId: Uuid,
	navigationId: Uuid,
});
export const UpdateZoneBody = t.Object(
	{
		localization: t.Optional(UnitLocalizationInput),
		filterDocument: t.Optional(FilterInputDocument),
		appearanceDocument: t.Optional(ZoneThemeInputDocument),
		startsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
		endsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
		localRuleRealmId: t.Optional(t.Nullable(Uuid)),
		revisionContext: t.Optional(RevisionContext),
	},
	{ minProperties: 1, additionalProperties: false },
);
export const ZonePageBody = t.Object(
	{
		slug: t.Optional(
			t.Nullable(
				t.String({
					minLength: 1,
					maxLength: 63,
					pattern: "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$",
				}),
			),
		),
		localization: t.Object(
			{
				language: ContentLanguage,
				title: t.String({ minLength: 1, maxLength: 500 }),
				document: UnitReferencedBlockInputDocument,
			},
			{ additionalProperties: false },
		),
		baseUnitRevisionId: t.Optional(Uuid),
		revisionContext: t.Optional(RevisionContext),
	},
	{ additionalProperties: false },
);
export const ZonePagePlacementBody = t.Object(
	{
		position: t.Optional(FractionalPositionInput),
		parentPageId: t.Optional(t.Nullable(Uuid)),
		baseStructureRevisionId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);
export const ZonePagePlacementDeleteBody = t.Object(
	{ baseStructureRevisionId: Uuid },
	{ additionalProperties: false },
);
export const ZoneNavigationBody = t.Object(
	{
		document: NavigationInputDocument,
	},
	{ additionalProperties: false },
);
export const ZoneNavigationReplaceBody = t.Object(
	{
		document: NavigationInputDocument,
		baseRevisionId: Uuid,
	},
	{ additionalProperties: false },
);
export const ZoneNavigationRevisionBody = t.Object(
	{ baseRevisionId: Uuid },
	{ additionalProperties: false },
);

export const ZoneResponse = t.Object({
	id: Uuid,
	slugAddress: NullablePublicSlugAddressResponse,
	language: t.Nullable(ContentLanguage),
	avatar: AvatarResponse,
	banner: ImageAssetResponse,
	cover: ImageAssetResponse,
	localizations: t.Array(
		t.Object({
			language: ContentLanguage,
			title: t.Nullable(t.String()),
			summary: t.Nullable(t.String()),
			avatar: AvatarResponse,
			banner: ImageAssetResponse,
			cover: ImageAssetResponse,
		}),
	),
	filterDocument: FilterResponseDocument,
	appearanceDocument: ZoneThemeResponseDocument,
	themeHero: ImageAssetResponse,
	startsAt: t.Nullable(DateTime),
	endsAt: t.Nullable(DateTime),
	localRuleRealmId: t.Nullable(Uuid),
	capabilities: t.Object(
		{
			canManage: t.Boolean(),
			canManageTheme: t.Boolean(),
			hasDevelopmentPreviewAccess: t.Boolean(),
		},
		{ additionalProperties: false },
	),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ZonePageResponse = t.Object({
	id: Uuid,
	zoneId: Uuid,
	slug: t.Nullable(t.String()),
	document: UnitReferencedBlockResponseDocument,
	home: t.Boolean(),
	placement: t.Nullable(
		t.Object({
			structureId: Uuid,
			nodeId: Uuid,
			parentPageId: t.Nullable(Uuid),
			position: FractionalPosition,
			latestStructureRevisionId: Uuid,
		}),
	),
	language: ContentLanguage,
	title: t.String(),
	localizations: t.Array(
		t.Object({
			language: ContentLanguage,
			title: t.String(),
			document: UnitReferencedBlockResponseDocument,
			contentStatus: t.UnionEnum(["draft", "published", "archived"]),
		}),
	),
	latestUnitRevisionId: Uuid,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ZonePageListResponse = t.Object({
	items: t.Array(ZonePageResponse),
	pageStructure: t.Nullable(
		t.Object({
			id: Uuid,
			latestRevisionId: Uuid,
		}),
	),
});
export const ZoneNavigationResponse = t.Object({
	id: Uuid,
	zoneId: Uuid,
	document: NavigationResponseDocument,
	latestRevisionId: Uuid,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ZoneNavigationListResponse = t.Object({ items: t.Array(ZoneNavigationResponse) });

export const ZoneRenderUnitResponse = t.Object({
	languageTag: t.Optional(t.Nullable(t.String({ maxLength: 255 }))),
	id: Uuid,
	kind: t.String(),
	zonePageSlug: t.Nullable(t.String()),
	language: t.Nullable(ContentLanguage),
	title: t.Nullable(t.String()),
	summary: t.Nullable(t.String()),
	avatar: AvatarResponse,
	banner: ImageAssetResponse,
	cover: ImageAssetResponse,
});
export const ZoneRenderWikiPostResponse = t.Object({
	...ZoneRenderUnitResponse.properties,
	body: PortableTextResponseDocument,
});
export const ZoneRenderResponse = t.Object({
	zone: ZoneResponse,
	resolvedPresentation: ResolvedUnitPresentationResponseDocument,
	page: t.Nullable(ZonePageResponse),
	dock: t.Nullable(
		t.Object({
			unitId: Uuid,
			surface: t.Literal("main"),
			document: DockResponseDocument,
		}),
	),
	navigations: t.Array(ZoneNavigationResponse),
	references: t.Object({
		units: t.Array(ZoneRenderUnitResponse),
		wikiPosts: t.Array(ZoneRenderWikiPostResponse),
		assets: t.Array(t.Object({ id: Uuid, url: t.String() })),
	}),
});
