"use client";

import {
	usePostApiTagPaths,
	usePostApiTagPathsDefinitionWarnings,
} from "@rezics/openapi-tanstack-query";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Button,
	Card,
	CardContent,
	PageHeading,
} from "@rezics/ui";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { useState } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import {
	TagPathMemberEditor,
	type EditableTagPathMember,
} from "../components/tag-path-member-editor";
import { TagPathPath } from "../components/tag-path";
import { tagPathHref } from "../routing/tag-links";

export function TagPathCreatePage() {
	const { t } = useTranslation(["tags", "ui"]);
	const router = useApplicationRouter();
	const [members, setMembers] = useState<EditableTagPathMember[]>([]);
	const [reviewedDefinition, setReviewedDefinition] = useState<string | null>(null);
	const [relatedPaths, setRelatedPaths] = useState<
		readonly {
			readonly pathId: string;
			readonly members: readonly {
				readonly tagId: string;
				readonly language: Parameters<typeof TagPathPath>[0]["members"][number]["language"];
				readonly title: string | null;
			}[];
		}[]
	>([]);
	const create = usePostApiTagPaths();
	const warnings = usePostApiTagPathsDefinitionWarnings();

	const memberTagIds = members.map(({ id }) => id);
	const definitionKey = memberTagIds.join(":");

	async function submit() {
		if (memberTagIds.length < 2) return;
		if (reviewedDefinition !== definitionKey) {
			const result = await warnings.mutateAsync({ body: { memberTagIds } });
			setReviewedDefinition(definitionKey);
			setRelatedPaths(result.items);
			if (result.items.length > 0) return;
		}
		const result = await create.mutateAsync({ body: { memberTagIds } });
		router.push(tagPathHref(result.pathId));
	}

	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.tags.createPath.title} />
				<p className="max-w-3xl text-muted-foreground">{t.tags.createPath.description}</p>
				<Card>
					<CardContent className="grid gap-5 p-5 sm:p-6">
						<TagPathMemberEditor
							members={members}
							onChange={(nextMembers) => {
								setMembers(nextMembers);
								setReviewedDefinition(null);
								setRelatedPaths([]);
								warnings.reset();
							}}
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
												/>
											</li>
										))}
									</ul>
								</AlertDescription>
							</Alert>
						) : null}
						<Button
							disabled={members.length < 2}
							isLoading={create.isPending || warnings.isPending}
							onClick={() => {
								void submit().catch(() => undefined);
							}}
							type="button"
						>
							{reviewedDefinition === definitionKey && relatedPaths.length > 0
								? t.tags.createPath.continueDistinct
								: t.tags.createPath.submit}
						</Button>
						<RequestFailure error={warnings.error ?? create.error} fallback={t.ui.retryLater} />
					</CardContent>
				</Card>
			</main>
		</RequireSession>
	);
}
