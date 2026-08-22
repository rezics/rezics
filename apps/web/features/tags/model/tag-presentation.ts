import type { PresentedAvatar } from "@rezics/avatar";
import type { ContentLanguage } from "@rezics/i18n";

import type { TaggableUnitType } from "./taggable-unit";

export type TagItemKey =
	| `global:${string}`
	| `realm:${string}:${string}`
	| `structure:${string}:${string}`;

export interface TagIdentity {
	readonly tagId: string;
	readonly language: ContentLanguage | null;
	readonly title: string | null;
	readonly summary: string | null;
	readonly avatar: PresentedAvatar | null;
}

export type TagVoteTarget =
	| {
			readonly kind: "global";
			readonly type: TaggableUnitType;
			readonly unitId: string;
			readonly tagId: string;
	  }
	| {
			readonly kind: "realm";
			readonly realmId: string;
			readonly unitId: string;
			readonly tagId: string;
	  };

export type TagVotePresentation =
	| {
			readonly kind: "available";
			readonly target: TagVoteTarget;
			readonly score: number;
			readonly voteCount: number;
			readonly viewerVote: -1 | 1 | null;
			readonly canVote: boolean;
	  }
	| {
			readonly kind: "not-applicable";
			readonly reason: "read-only-reference" | "structure-member";
	  };

export type TagContextPresentation =
	| {
			readonly kind: "global";
			readonly pinned: boolean;
	  }
	| {
			readonly kind: "realm";
			readonly realmId: string;
			readonly realmLanguage: ContentLanguage | null;
			readonly realmTitle: string | null;
			readonly contextPostId: string | null;
	  }
	| {
			readonly kind: "structure";
			readonly structureId: string;
	  };

export interface TagPresentation {
	readonly itemKey: TagItemKey;
	readonly identity: TagIdentity;
	readonly context: TagContextPresentation;
	readonly vote: TagVotePresentation;
}

export interface RealmTagGroupPresentation {
	readonly realmId: string;
	readonly language: ContentLanguage | null;
	readonly title: string | null;
	readonly summary: string | null;
	readonly avatar: PresentedAvatar | null;
	readonly canVote: boolean;
	readonly tags: readonly TagPresentation[];
}

export interface RealmTagVoteContextPresentation {
	readonly realmId: string;
	readonly language: ContentLanguage | null;
	readonly title: string | null;
	readonly summary: string | null;
	readonly avatar: PresentedAvatar | null;
}

export type TagVoteContextSelection =
	| { readonly kind: "global" }
	| {
			readonly kind: "realm";
			readonly realm: RealmTagVoteContextPresentation;
	  };
