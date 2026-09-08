"use client";
import type { CatalogReference } from "@rezics/reference";
import { Button } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { ResourceProgressControls } from "@/features/progress/components/resource-progress-controls";
import { UnitScoreControl } from "@/features/reviews/components/unit-score-control";
import { useTranslation } from "@/i18n/client";
export function CatalogResourceActions({
	reference,
	shape,
	canEdit,
}: {
	reference: CatalogReference;
	shape: string;
	canEdit: boolean;
}) {
	const { t } = useTranslation(["engagement", "ui", "units", "tags", "collections"]),
		base = `/catalog/${reference.owner}/${reference.id}`;
	const rated =
		reference.owner === "publishing" ||
		reference.owner === "music" ||
		reference.owner === "program" ||
		reference.owner === "software" ||
		reference.owner === "grouping";
	return (
		<section className="grid gap-4">
			<div className="flex flex-wrap gap-2">
				{canEdit ? (
					<Button asChild variant="outline">
						<AppLink href={`${base}/edit`}>{t.ui.edit}</AppLink>
					</Button>
				) : null}
				<Button asChild variant="outline">
					<AppLink href={`${base}/tags`}>{t.tags.page.title}</AppLink>
				</Button>
				<Button asChild variant="outline">
					<AppLink href={`${base}/credits`}>{t.units.detail.credits}</AppLink>
				</Button>
				<Button asChild variant="outline">
					<AppLink href={`${base}/collections`}>{t.collections.title}</AppLink>
				</Button>
				{rated ? (
					<>
						<Button asChild variant="outline">
							<AppLink href={`${base}/discussion`}>{t.engagement.discussions}</AppLink>
						</Button>
						<Button asChild variant="outline">
							<AppLink href={`${base}/reviews`}>{t.engagement.reviews}</AppLink>
						</Button>
						<Button asChild variant="outline">
							<AppLink href={`${base}/excerpts`}>{t.engagement.excerpts}</AppLink>
						</Button>
					</>
				) : null}
			</div>
			{rated ? <UnitScoreControl targetId={reference.id} /> : null}
			<ResourceProgressControls reference={reference} shape={shape} />
		</section>
	);
}
