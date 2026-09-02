"use client";

import {
	type PostApiTagPathsDefinitionWarningsStatus200,
	usePostApiTagPaths,
	usePostApiTagPathsDefinitionWarnings,
	usePostApiTagRelations,
} from "@rezics/openapi-tanstack-query";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Button,
	Card,
	CardContent,
	ManagementWorkspaceSectionHeader,
} from "@rezics/ui";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { studioSectionHref } from "@/features/create/routing/studio-routes";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import {
	TagPathMemberEditor,
	type EditableTagPathMember,
	type EditableTagRelationKind,
} from "../components/tag-path-member-editor";
import { TagPathPath } from "../components/tag-path";
import { tagPathHref } from "../routing/tag-links";

export function TagPathCreatePage() {
	const { t } = useTranslation(["tags", "ui"]);
	const router = useApplicationRouter();
	const [members, setMembers] = useState<EditableTagPathMember[]>([]);
	const [relationKinds, setRelationKinds] = useState<EditableTagRelationKind[]>([]);
	const [reviewedDefinition, setReviewedDefinition] = useState<string | null>(null);
	const [relatedPaths, setRelatedPaths] = useState<
		PostApiTagPathsDefinitionWarningsStatus200["items"]
	>([]);
	const [resolvedRelations, setResolvedRelations] = useState<{
		readonly definitionKey: string;
		readonly relationIds: readonly string[];
	} | null>(null);
	const create = usePostApiTagPaths();
	const warnings = usePostApiTagPathsDefinitionWarnings();
	const createRelation = usePostApiTagRelations();

	const memberNodeIds = members.map(({ id }) => id);
	const definitionKey = JSON.stringify([memberNodeIds, relationKinds]);
	const resetReview = () => {
		setReviewedDefinition(null);
		setRelatedPaths([]);
		setResolvedRelations(null);
		warnings.reset();
	};
	async function resolveRelationIds() {
		if (resolvedRelations?.definitionKey === definitionKey)
			return [...resolvedRelations.relationIds];
		const relationIds = await Promise.all(
			relationKinds.map(async (relationKind, index) => {
				const parentNodeId = memberNodeIds[index];
				const childNodeId = memberNodeIds[index + 1];
				if (!parentNodeId || !childNodeId) throw new Error("Incomplete Tag Path relation");
				const result = await createRelation.mutateAsync({
					body: { parentNodeId, childNodeId, relationKind },
				});
				return result.relationId;
			}),
		);
		setResolvedRelations({ definitionKey, relationIds });
		return relationIds;
	}

	async function submit() {
		if (memberNodeIds.length < 2 || relationKinds.length !== memberNodeIds.length - 1) return;
		const relationIds = await resolveRelationIds();
		if (reviewedDefinition !== definitionKey) {
			const result = await warnings.mutateAsync({ body: { memberNodeIds, relationIds } });
			setReviewedDefinition(definitionKey);
			setRelatedPaths(result.items);
			if (result.items.length > 0) return;
		}
		const result = await create.mutateAsync({ body: { memberNodeIds, relationIds } });
		router.push(tagPathHref(result.pathId));
	}

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={studioSectionHref("tag")}
				backLabel={t.tags.create.backToStudioTags}
				description={t.tags.createPath.description}
				link={Link}
				title={t.tags.createPath.title}
			/>
			<div className="max-w-4xl">
				<Card>
					<CardContent className="grid gap-5 p-5 sm:p-6">
						<TagPathMemberEditor
							members={members}
							onChange={(nextMembers) => {
								setMembers(nextMembers);
								resetReview();
							}}
							onRelationKindsChange={(nextRelationKinds) => {
								setRelationKinds(nextRelationKinds);
								resetReview();
							}}
							relationKinds={relationKinds}
						/>
						{relatedPaths.length > 0 ? (
							<Alert variant="warning">
								<AlertTitle>{t.tags.createPath.relatedTitle}</AlertTitle>
								<AlertDescription className="grid gap-3">
									<p>{t.tags.createPath.relatedDescription}</p>
									<ul className="grid gap-2">
										{relatedPaths.map((path) => (
											<li key={path.pathId}>
												<TagPathPath
													ariaLabel={t.tags.paths.pathLabel}
													fallback={t.tags.paths.memberFallback}
													members={path.members}
													relationLabel={(kind) =>
														t.tags.expressions.relations[
															kind as keyof typeof t.tags.expressions.relations
														] ?? t.tags.expressions.relationFallback
													}
												/>
											</li>
										))}
									</ul>
								</AlertDescription>
							</Alert>
						) : null}
						<Button
							disabled={members.length < 2 || relationKinds.length !== members.length - 1}
							isLoading={create.isPending || warnings.isPending || createRelation.isPending}
							onClick={() => {
								void submit().catch(() => undefined);
							}}
							type="button"
						>
							{reviewedDefinition === definitionKey && relatedPaths.length > 0
								? t.tags.createPath.continueDistinct
								: t.tags.createPath.submit}
						</Button>
						<RequestFailure
							error={createRelation.error ?? warnings.error ?? create.error}
							fallback={t.ui.retryLater}
						/>
					</CardContent>
				</Card>
			</div>
		</section>
	);
}
