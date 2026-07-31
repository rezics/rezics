"use client";

import type { UnitPredicate } from "@rezics/filter";
import { useQueryState } from "nuqs";
import { useState } from "react";

import type { FeedItem } from "@/features/content-feed/components/feed-item-card";
import { ApiFeedList } from "@/features/content-feed/data/api-feed-list";
import {
	feedContentParser,
	feedLanguagesParser,
	feedSortParser,
	feedTagIdsParser,
} from "@/features/content-feed/routing/feed-search-params";
import { RealmFeedModerationSheet } from "./realm-feed-moderation-sheet";
import { RealmFeedManagementActions } from "./realm-feed-management-actions";
import { RealmPolicyTagDialog } from "./realm-policy-tag-dialog";

type RealmFeedManagementRequest =
	| Readonly<{ kind: "moderation"; target: FeedItem }>
	| Readonly<{ kind: "policy-tag"; target: FeedItem }>;

export function RealmFeed({
	additionalFilter,
	canModerateUnits,
	canManagePins,
	canManageTags,
	contentKinds,
	realmId,
	showControls = true,
}: {
	readonly additionalFilter?: UnitPredicate;
	readonly canModerateUnits: boolean;
	readonly canManagePins: boolean;
	readonly canManageTags: boolean;
	readonly contentKinds?: readonly "post:wiki"[];
	readonly realmId: string;
	readonly showControls?: boolean;
}) {
	const [sort, setSort] = useQueryState("sort", feedSortParser);
	const [selectedContentKinds, setContentKinds] = useQueryState("content", feedContentParser);
	const [languages, setLanguages] = useQueryState("languages", feedLanguagesParser);
	const [tagIds, setTagIds] = useQueryState("tags", feedTagIdsParser);
	const [managementRequest, setManagementRequest] = useState<RealmFeedManagementRequest>();

	return (
		<>
			<ApiFeedList
				additionalFilter={additionalFilter}
				contentKinds={contentKinds ?? selectedContentKinds}
				languages={languages}
				onContentKindsChange={
					showControls && !contentKinds
						? (nextKinds) => void setContentKinds([...nextKinds])
						: undefined
				}
				onLanguagesChange={
					showControls
						? (nextLanguages) => void setLanguages([...nextLanguages])
						: undefined
				}
				onSortChange={showControls ? (nextSort) => void setSort(nextSort) : undefined}
				onTagIdsChange={
					showControls ? (nextTagIds) => void setTagIds([...nextTagIds]) : undefined
				}
				pagination="infinite"
				realmIds={[realmId]}
				renderOverflowActions={(item) => (
					<RealmFeedManagementActions
						canManagePins={canManagePins}
						canManageTags={canManageTags}
						canModerateUnits={canModerateUnits}
						item={item}
						onAddPolicyTag={() =>
							setManagementRequest({ kind: "policy-tag", target: item })
						}
						onModerate={() =>
							setManagementRequest({ kind: "moderation", target: item })
						}
						realmId={realmId}
					/>
				)}
				sort={sort}
				tagIds={tagIds}
			/>
			{managementRequest?.kind === "policy-tag" ? (
				<RealmPolicyTagDialog
					key={managementRequest.target.id}
					onOpenChange={(open) => {
						if (!open) setManagementRequest(undefined);
					}}
					open
					realmId={realmId}
					unitId={managementRequest.target.id}
				/>
			) : managementRequest?.kind === "moderation" ? (
				<RealmFeedModerationSheet
					key={managementRequest.target.id}
					onOpenChange={(open) => {
						if (!open) setManagementRequest(undefined);
					}}
					realmId={realmId}
					target={{
						id: managementRequest.target.id,
						title: managementRequest.target.title,
					}}
				/>
			) : null}
		</>
	);
}
