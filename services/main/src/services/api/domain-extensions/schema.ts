import { JsonValue } from "@rezics/portable-text";
import { t } from "elysia";

import { DateTime, LocalizationInput, Uuid } from "../schema";

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

export const GameParams = t.Object({ gameId: Uuid });
export const GameRequirementParams = t.Object({ gameId: Uuid, requirementId: Uuid });
export const SystemRequirementBody = t.Object(
	{
		platformEntityId: t.Optional(t.Nullable(Uuid)),
		tier: t.String({ minLength: 1, maxLength: 32 }),
		language: t.Optional(t.Nullable(t.String({ minLength: 2, maxLength: 35 }))),
		sourceLinkId: t.Optional(t.Nullable(Uuid)),
		hardware: t.Record(t.String(), JsonValue),
		rawText: t.Optional(t.Nullable(t.String({ maxLength: 20_000 }))),
	},
	{ additionalProperties: false },
);

export const CreateZoneBody = t.Object(
	{
		ownerRealmId: Uuid,
		slug: t.Optional(
			t.String({ minLength: 3, maxLength: 72, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
		),
		localization: LocalizationInput,
		boundary: t.Record(t.String(), JsonValue),
		nav: t.Record(t.String(), JsonValue),
		theme: t.Record(t.String(), JsonValue),
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
		config: t.Record(t.String(), JsonValue),
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
	gameId: Uuid,
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
	config: t.Unknown(),
	position: t.String(),
	home: t.Boolean(),
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const ZonePageListResponse = t.Object({ items: t.Array(ZonePageResponse) });
