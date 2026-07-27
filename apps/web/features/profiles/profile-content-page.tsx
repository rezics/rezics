"use client";

import { useQueryState } from "nuqs";

import { FeedContentSelector } from "@/features/content-feed/components/feed-content-selector";
import {
	SearchFeedResults,
	type SearchFeedSource,
	useSearchFeedQuery,
} from "@/features/content-feed/data/search-feed-list";
import { useTranslation } from "@/i18n/client";
import {
	createProfileContentRequest,
	normalizeProfileContentKinds,
	profileContentParser,
	ProfileContentKindValues,
} from "./profile-content-query";
import { useProfileContext } from "./profile-layout";

const ProfileContentFeedSource = {
	kind: "template",
	template: "global",
} satisfies SearchFeedSource;

export function ProfileContentPage() {
	const { t } = useTranslation(["feed", "profiles"]);
	const { profile } = useProfileContext();
	const [contentKinds, setContentKinds] = useQueryState("content", profileContentParser);
	const query = useSearchFeedQuery({
		request: createProfileContentRequest({
			contentKinds,
			profileId: profile.id,
		}),
		source: ProfileContentFeedSource,
	});

	return (
		<section aria-labelledby="profile-content-title" className="max-w-3xl">
			<div>
				<h2 className="font-heading font-bold text-2xl" id="profile-content-title">
					{t.profiles.contentTitle}
				</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-6">
					{t.profiles.contentDescription}
				</p>
			</div>

			<div
				aria-label={t.feed.contentFilterLabel}
				className="mt-6 flex items-center border-b border-border-weak pb-5"
				role="group"
			>
				<FeedContentSelector
					onValueChange={(nextKinds) =>
						void setContentKinds(normalizeProfileContentKinds(nextKinds))
					}
					options={ProfileContentKindValues}
					value={contentKinds}
				/>
			</div>

			<div className="mt-4">
				<SearchFeedResults
					aria-label={t.profiles.contentTitle}
					emptyBody={t.profiles.contentEmptyDescription}
					emptyTitle={t.profiles.contentEmptyTitle}
					infinite
					query={query}
				/>
			</div>
		</section>
	);
}
