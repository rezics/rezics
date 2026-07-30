"use client";

import { Card, CardContent } from "@rezics/ui";

import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { SignInButton } from "@/features/auth/auth-portal";
import { PostList } from "@/features/posts/post-list";
import { SubjectPostComposer } from "@/features/posts/subject-post-composer";
import { postDiscussionHref } from "@/features/posts/url";
import { useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { UnitDetailSectionFrame } from "../components/unit-detail-section-frame";
import { useUnitDetail } from "../components/unit-detail-workspace";
import { unitDetailPageCopy } from "../model/unit-detail-copy";

export function UnitDiscussionPage() {
	const detail = useUnitDetail();
	const router = useApplicationRouter();
	const { data: session } = useHydratedSession();
	const { t } = useTranslation(["actions", "units"]);
	const labels = unitDetailPageCopy(t, detail.type, "discussion");
	return (
		<UnitDetailSectionFrame description={labels.description} title={labels.title}>
			<Card>
				<CardContent className="p-5 sm:p-6">
					{session ? (
						<SubjectPostComposer
							onCreated={(postId) => router.push(postDiscussionHref(postId))}
							postKind="post"
							subjectId={detail.unit.id}
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
			<PostList showFeedControls subjectId={detail.unit.id} />
		</UnitDetailSectionFrame>
	);
}
