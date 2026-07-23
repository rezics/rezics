"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	getApiTagStructuresByStructureIdQueryKey,
	useDeleteApiTagStructuresByStructureIdVote,
	useGetApiTagStructuresByStructureId,
	useGetApiUsersMe,
	usePutApiTagStructuresByStructureId,
	usePutApiTagStructuresByStructureIdVote,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	Field,
	FieldLabel,
	PageHeading,
	QueryFailure,
	QueryPending,
	Textarea,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import {
	TagStructureMemberEditor,
	type EditableTagStructureMember,
} from "../components/tag-structure-member-editor";
import { TagStructurePath } from "../components/tag-structure-path";
import { TagVoteControls } from "../components/tag-vote-controls";

function TagStructureAdminEditor({
	structureId,
	updatedAt,
	language,
	initialMembers,
	onUpdated,
}: {
	readonly structureId: string;
	readonly updatedAt: string;
	readonly language: ReturnType<typeof toContentLanguage>;
	readonly initialMembers: readonly EditableTagStructureMember[];
	readonly onUpdated: () => Promise<unknown>;
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const [members, setMembers] = useState<EditableTagStructureMember[]>([...initialMembers]);
	const [reason, setReason] = useState("");
	const update = usePutApiTagStructuresByStructureId({
		mutation: { onSuccess: () => void onUpdated() },
	});
	const hasChanged =
		members.length !== initialMembers.length ||
		members.some((member, index) => member.id !== initialMembers[index]?.id);
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const normalizedReason = reason.trim();
		if (!hasChanged || members.length < 2 || !normalizedReason) return;
		update.mutate({
			path: { structureId },
			query: { language },
			body: {
				memberTagIds: members.map(({ id }) => id),
				updatedAt,
				reason: normalizedReason,
			},
		});
	};

	return (
		<Card>
			<CardContent className="grid gap-5 p-5 sm:p-6">
				<div className="grid gap-1">
					<h2 className="font-semibold">{t.tags.adminEditStructure.title}</h2>
					<p className="text-sm text-muted-foreground">
						{t.tags.adminEditStructure.description}
					</p>
				</div>
				<form className="grid gap-5" onSubmit={submit}>
					<TagStructureMemberEditor members={members} onChange={setMembers} />
					<Field required>
						<FieldLabel>{t.tags.adminEditStructure.reasonLabel}</FieldLabel>
						<Textarea
							maxLength={500}
							onChange={(event) => setReason(event.currentTarget.value)}
							placeholder={t.tags.adminEditStructure.reasonPlaceholder}
							required
							value={reason}
						/>
					</Field>
					<Button
						disabled={!hasChanged || members.length < 2 || !reason.trim()}
						isLoading={update.isPending}
						type="submit"
					>
						{t.tags.adminEditStructure.submit}
					</Button>
					<RequestFailure error={update.error} fallback={t.ui.retryLater} />
				</form>
			</CardContent>
		</Card>
	);
}

export function TagStructureDetailPage({ structureId }: { readonly structureId: string }) {
	const { data: session } = useHydratedSession();
	const { locale, t } = useTranslation(["tags", "ui"]);
	const queryClient = useQueryClient();
	const queryInput = {
		path: { structureId },
		query: { language: toContentLanguage(locale.target) },
	} as const;
	const query = useGetApiTagStructuresByStructureId(queryInput);
	const me = useGetApiUsersMe({ query: { enabled: Boolean(session) } });
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: getApiTagStructuresByStructureIdQueryKey(queryInput),
		});
	const vote = usePutApiTagStructuresByStructureIdVote({
		mutation: { onSuccess: invalidate },
	});
	const clearVote = useDeleteApiTagStructuresByStructureIdVote({
		mutation: { onSuccess: invalidate },
	});

	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const canCorrect = me.data?.platformCapabilities.includes("unit.edit") ?? false;

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={t.tags.structures.title} />
			<Card>
				<CardContent className="grid gap-5 p-5 sm:p-6">
					<TagStructurePath
						ariaLabel={t.tags.structures.pathLabel}
						fallback={t.tags.structures.memberFallback}
						members={query.data.members}
					/>
					<p className="text-sm text-muted-foreground">
						{t.tags.createStructure.description}
					</p>
					<TagVoteControls
						canVote={Boolean(session)}
						isPending={vote.isPending || clearVote.isPending}
						onClear={() => clearVote.mutate({ path: { structureId } })}
						onVote={(value) =>
							vote.mutate({
								path: { structureId },
								body: { value },
							})
						}
						score={toFiniteApiNumber(query.data.score) ?? 0}
						viewerVote={query.data.viewerVote}
						voteCount={toNonNegativeApiInteger(query.data.voteCount)}
					/>
					<RequestFailure
						error={vote.error ?? clearVote.error}
						fallback={t.ui.retryLater}
					/>
				</CardContent>
			</Card>
			{canCorrect ? (
				<TagStructureAdminEditor
					initialMembers={query.data.members.map((member) => ({
						id: member.tagId,
						label: member.title ?? t.tags.structures.memberFallback,
					}))}
					key={query.data.updatedAt}
					language={queryInput.query.language}
					onUpdated={invalidate}
					structureId={structureId}
					updatedAt={query.data.updatedAt}
				/>
			) : null}
		</main>
	);
}
