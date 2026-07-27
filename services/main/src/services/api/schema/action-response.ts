import { StatusCodes } from "http-status-codes";
import { t } from "elysia";
import { PortableTextDocument } from "@rezics/block";
import { ContentLanguage, DateTime, FractionalPosition, OrdinalPosition, UnitKind, Uuid } from ".";
import {
	RealmMemberRoleValues,
	RealmMemberStateValues,
} from "../../database/schema/contract-values";
import { NullablePublicSlugAddressResponse } from "../slug-addresses/schema";
import { AvatarResponse, FeedPostItemResponse, FeedUnitItemResponse } from "./response";

const NullableUuid = t.Nullable(Uuid);

export const IdResponse = t.Object({ id: Uuid });
export const NoContentResponse = {
	[StatusCodes.NO_CONTENT]: { description: "No Content" },
} as const;

export const SavedResponse = t.Object({ saved: t.Boolean() });
export const FavoriteResponse = t.Object({ favorited: t.Boolean(), collectionId: Uuid });

export const ScoreResponse = t.Object({ scoreId: Uuid, score: t.Integer() });
export const ScoreAggregateResponse = t.Object({
	totalScore: t.Integer(),
	totalCount: t.Integer(),
	distribution: t.Record(t.String(), t.Integer()),
});
export const ViewerScoreListResponse = t.Object({
	items: t.Array(
		t.Object({
			scoreId: Uuid,
			contextUnitId: Uuid,
			value: t.Integer({ minimum: 1, maximum: 10 }),
			contextUnitTitle: t.Nullable(t.String()),
			updatedAt: DateTime,
		}),
	),
});
export const ScoreContextResponse = t.Object({ contextPostId: t.Nullable(Uuid) });

export const ReactionSummaryResponse = t.Object({
	items: t.Array(t.Object({ reaction: t.String(), count: t.Integer() })),
	viewerReaction: t.Nullable(t.String()),
});
export const ReactionResponse = t.Object({ reaction: t.Nullable(t.String()) });

export const PollVoteResponse = t.Object({ optionIds: t.Array(Uuid) });

export const FollowResponse = t.Object({ following: t.Boolean() });
export const FollowingStatusResponse = t.Union([
	t.Object({
		following: t.Literal(true),
		favorite: t.Boolean(),
		position: FractionalPosition,
	}),
	t.Object({
		following: t.Literal(false),
		favorite: t.Null(),
		position: t.Null(),
	}),
]);
export const FollowingListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			slugAddress: NullablePublicSlugAddressResponse,
			kind: UnitKind,
			language: t.Nullable(ContentLanguage),
			title: t.Nullable(t.String()),
			avatar: AvatarResponse,
			cover: t.Nullable(t.Object({ id: Uuid, url: t.String() })),
			position: FractionalPosition,
			favorite: t.Boolean(),
			createdAt: DateTime,
			updatedAt: DateTime,
		}),
	),
	nextCursor: t.Nullable(t.String()),
});
export const FollowingPreferenceResponse = t.Object({
	unitId: Uuid,
	position: FractionalPosition,
	favorite: t.Boolean(),
	updatedAt: DateTime,
});
export const BlockResponse = t.Object({ blocked: t.Boolean() });
export const UserBlockListResponse = t.Object({
	items: t.Array(
		t.Object({
			userId: Uuid,
			name: t.Nullable(t.String()),
			createdAt: DateTime,
		}),
	),
});
export const ShareResponse = t.Object({ shared: t.Boolean() });
export const MembershipResponse = t.Object({ state: t.String() });
export const RealmMemberListResponse = t.Object({
	items: t.Array(
		t.Object({
			profileId: Uuid,
			language: ContentLanguage,
			name: t.Nullable(t.String()),
			slugAddress: NullablePublicSlugAddressResponse,
			avatar: AvatarResponse,
			role: t.UnionEnum(RealmMemberRoleValues),
			state: t.UnionEnum(RealmMemberStateValues),
			joinedAt: DateTime,
		}),
	),
});
export const RealmMemberResponse = t.Object({
	realmId: Uuid,
	profileId: Uuid,
	role: t.UnionEnum(RealmMemberRoleValues),
	state: t.UnionEnum(RealmMemberStateValues),
	joinedAt: DateTime,
	updatedAt: DateTime,
});
export const RealmRuleRevisionResponse = t.Object({ id: Uuid, version: t.Integer() });
export const RealmRulesResponse = t.Object({
	revisionId: NullableUuid,
	version: t.Nullable(t.Integer()),
	requireOnJoin: t.Boolean(),
	requireOnPost: t.Boolean(),
	requireOnUpdate: t.Boolean(),
	items: t.Array(
		t.Object({
			id: Uuid,
			position: OrdinalPosition,
			language: ContentLanguage,
			title: t.String(),
			content: PortableTextDocument,
		}),
	),
});
export const RealmPinResponse = t.Object({
	realmId: Uuid,
	unitId: Uuid,
	kind: t.String(),
	position: FractionalPosition,
	createdAt: DateTime,
	updatedAt: DateTime,
});
export const RealmPinListResponse = t.Object({
	items: t.Array(RealmPinResponse),
	contentItems: t.Array(t.Union([FeedUnitItemResponse, FeedPostItemResponse])),
});
