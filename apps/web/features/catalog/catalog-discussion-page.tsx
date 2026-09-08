"use client";
import type { CatalogReference } from "@rezics/reference";
import { useReadCatalogResource } from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { SignInButton } from "@/features/auth/auth-portal";
import { PostList } from "@/features/posts/post-list";
import { SubjectPostComposer } from "@/features/posts/subject-post-composer";
import { postDiscussionHref } from "@/features/posts/url";
import { useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
export function CatalogDiscussionPage({ reference }: { reference: CatalogReference }) {
	const { t } = useTranslation(["actions", "posts", "units"]),
		router = useApplicationRouter(),
		session = useHydratedSession();
	const resource = useReadCatalogResource({ path: reference });
	if (resource.isPending) return <QueryPending />;
	if (resource.isError)
		return <QueryFailure error={resource.error} retry={() => void resource.refetch()} />;
	return (
		<main className="mx-auto grid max-w-4xl gap-6 px-4 py-8">
			<PageHeading title={t.posts.openDiscussionComposer} />
			<Button asChild variant="outline">
				<AppLink href={`/catalog/${reference.owner}/${reference.id}`}>
					{t.units.nativeSemantics.openRecord}
				</AppLink>
			</Button>
			{session.data ? (
				<SubjectPostComposer
					subjectId={reference.id}
					postKind="post"
					onCreated={(id) => router.push(postDiscussionHref(id))}
				/>
			) : (
				<SignInButton>{t.actions.login}</SignInButton>
			)}
			<PostList showFeedControls subjectId={reference.id} />
		</main>
	);
}
