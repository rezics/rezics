"use client";

import { Card, CardContent } from "@rezics/ui";

import { SignInButton } from "@/features/auth/auth-portal";
import { PostList } from "@/features/posts/post-list";
import { SubjectPostComposer } from "@/features/posts/subject-post-composer";
import { useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { CatalogDetailSectionFrame } from "../components/catalog-detail-section-frame";
import { useCatalogDetail } from "../components/catalog-detail-workspace";

export function CatalogDiscussionPage() {
	const detail = useCatalogDetail();
	const { data: session } = useHydratedSession();
	const { t } = useTranslation(["actions", "units"]);
	const labels =
		detail.type === "book"
			? {
					title: t.units.detail.tabs.book.discussion,
					description: t.units.detail.sectionDescriptions.book.discussion,
				}
			: detail.type === "media"
				? {
						title: t.units.detail.tabs.media.discussion,
						description: t.units.detail.sectionDescriptions.media.discussion,
					}
				: {
						title: t.units.detail.tabs.software.discussion,
						description: t.units.detail.sectionDescriptions.software.discussion,
					};
	return (
		<CatalogDetailSectionFrame description={labels.description} title={labels.title}>
			<Card>
				<CardContent className="p-5 sm:p-6">
					{session ? (
						<SubjectPostComposer subjectId={detail.unit.id} />
					) : (
						<SignInButton variant="outline">{t.actions.login}</SignInButton>
					)}
				</CardContent>
			</Card>
			<PostList subjectId={detail.unit.id} />
		</CatalogDetailSectionFrame>
	);
}
