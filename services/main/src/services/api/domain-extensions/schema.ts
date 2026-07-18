import { JsonValue } from "@rezics/portable-text";
import {
	ZoneBoundaryDocument,
	ZoneMenuDocument,
	ZonePageDocument,
	ZoneThemeDocument,
} from "@rezics/content-structure";
import { t } from "elysia";

import { DateTime, LanguageTag, LocalizationInput, Uuid } from "../schema";

export const CreateSeriesBody = t.Object(
	{
		kind: t.String({ minLength: 1, maxLength: 64 }),
		slug: t.Optional(
			t.String({ minLength: 3, maxLength: 72, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
		),
		localization: LocalizationInput,
	},
	{ additionalProperties: false },
);
export const SeriesParams = t.Object({ seriesId: Uuid });
export const SeriesReleaseParams = t.Object({ seriesId: Uuid, releaseId: Uuid });
export const UpsertSeriesReleaseBody = t.Object(
	{
		position: t.String({ minLength: 1, maxLength: 64 }),
		label: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
		releasedOn: t.Optional(t.Nullable(t.String({ format: "date" }))),
	},
	{ additionalProperties: false },
);

export const SoftwareParams = t.Object({ softwareId: Uuid });
export const SoftwareRequirementParams = t.Object({
	softwareId: Uuid,
	requirementId: Uuid,
});
export const SystemRequirementBody = t.Object(
	{
		platformEntityId: t.Optional(t.Nullable(Uuid)),
		tier: t.String({ minLength: 1, maxLength: 32 }),
		language: t.Optional(t.Nullable(LanguageTag)),
		sourceLinkId: t.Optional(t.Nullable(Uuid)),
		hardware: t.Record(t.String(), JsonValue),
		rawText: t.Optional(t.Nullable(t.String({ maxLength: 20_000 }))),
	},
	{ additionalProperties: false },
);

export const CreateZoneBody = t.Object(
	{
		managingRealmId: t.Optional(t.Nullable(Uuid)),
		slug: t.Optional(
			t.String({ minLength: 3, maxLength: 72, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
		),
		localization: LocalizationInput,
		boundaryDocument: ZoneBoundaryDocument,
		themeDocument: ZoneThemeDocument,
		menuDocument: t.Optional(ZoneMenuDocument),
		startsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
		endsAt: t.Optional(t.Nullable(t.String({ format: "date-time" }))),
	},
	{ additionalProperties: false },
);
export const ZoneParams = t.Object({ zoneId: Uuid });
export const ZonePageParams = t.Object({ zoneId: Uuid, pageId: Uuid });
export const ZonePageBody = t.Object(
	{
		slug: t.String({ minLength: 1, maxLength: 120, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
		document: ZonePageDocument,
		position: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
		home: t.Optional(t.Boolean()),
	},
	{ additionalProperties: false },
);

export const SeriesReleaseResponse = t.Object({
	seriesId: Uuid,
	releaseUnitId: Uuid,
	position: t.String(),
	label: t.Nullable(t.String()),
	releasedOn: t.Nullable(t.String()),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const SeriesReleaseListResponse = t.Object({ items: t.Array(SeriesReleaseResponse) });

export const SystemRequirementResponse = t.Object({
	id: Uuid,
	softwareId: Uuid,
	platformEntityId: t.Nullable(Uuid),
	tier: t.String(),
	language: t.Nullable(t.String()),
	sourceLinkId: t.Nullable(Uuid),
	hardware: t.Unknown(),
	rawText: t.Nullable(t.String()),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const SystemRequirementListResponse = t.Object({
	items: t.Array(SystemRequirementResponse),
});

export const ZonePageResponse = t.Object({
	id: Uuid,
	zoneId: Uuid,
	slug: t.String(),
	document: ZonePageDocument,
	position: t.String(),
	home: t.Boolean(),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ZonePageListResponse = t.Object({ items: t.Array(ZonePageResponse) });

export const ZoneMenuParams = t.Object({
	zoneId: Uuid,
	slot: t.String({
		minLength: 1,
		maxLength: 64,
		pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
	}),
});
export const ZoneMenuBody = t.Object(
	{
		document: ZoneMenuDocument,
		position: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
	},
	{ additionalProperties: false },
);
export const ZoneMenuResponse = t.Object({
	id: Uuid,
	zoneId: Uuid,
	slot: t.String(),
	document: ZoneMenuDocument,
	position: t.String(),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ZoneMenuListResponse = t.Object({
	items: t.Array(ZoneMenuResponse),
});
