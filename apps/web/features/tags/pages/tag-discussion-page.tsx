"use client";

import { Card, CardContent } from "@rezics/ui";

import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { SignInButton } from "@/features/auth/auth-portal";
import { PostList } from "@/features/posts/post-list";
import { SubjectPostComposer } from "@/features/posts/subject-post-composer";
import { postDiscussionHref } from "@/features/posts/url";
import { useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { TagDetailSectionFrame } from "../components/tag-detail-section-frame";
import { useTagDetail } from "../components/tag-detail-workspace";

export function TagDiscussionPage() {
	const tag = useTagDetail();
	const router = useApplicationRouter();
	const { data: session } = useHydratedSession();
	const { t } = useTranslation(["actions", "tags"]);
	return (
		<TagDetailSectionFrame
			description={t.tags.detail.discussionDescription}
			title={t.tags.detail.discussionTitle}
		>
			<Card>
				<CardContent className="p-5 sm:p-6">
					{session ? (
						<SubjectPostComposer
							onCreated={(postId) => router.push(postDiscussionHref(postId))}
							postKind="post"
							subjectId={tag.id}
						/>
					) : (
						<SignInButton
							className="h-11 w-full justify-start rounded-xl text-muted-foreground"
							variant="outline"
						>
							{t.actions.login}
						</SignInButton>
					)}
				</CardContent>
			</Card>
			<PostList showFeedControls subjectId={tag.id} />
		</TagDetailSectionFrame>
	);
}
