import type { ContentLanguage } from "@rezics/i18n";

import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";

export type TagItemKey =
	`global:${string}` | `realm:${string}:${string}` | `structure:${string}:${string}`;

export interface TagIdentity {
	readonly tagId: string;
	readonly language: ContentLanguage | null;
	readonly title: string | null;
	readonly summary: string | null;
}

export type TagVoteTarget =
	| {
			readonly kind: "global";
			readonly type: CatalogDetailUnitType;
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
			readonly unavailableReason?: "signed-out" | "not-member";
	  }
	| { readonly kind: "not-applicable"; readonly reason: "policy" | "structure-member" };

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
			readonly policy: boolean;
			readonly contextPostId?: string;
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
	readonly tags: readonly TagPresentation[];
}
