"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	getApiUnitsByTypeByUnitIdTagsQueryKey,
	useDeleteApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote,
	useDeleteApiUnitsByTypeByUnitIdTagStructuresByStructureIdVote,
	useDeleteApiUnitsByTypeByUnitIdTagsByTagIdVote,
	useGetApiUnitsByTypeByUnitIdTags,
	usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote,
	usePutApiUnitsByTypeByUnitIdTagStructuresByStructureId,
	usePutApiUnitsByTypeByUnitIdTagStructuresByStructureIdVote,
	usePutApiUnitsByTypeByUnitIdTagsByTagId,
	usePutApiUnitsByTypeByUnitIdTagsByTagIdVote,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	EntityPicker,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { SignInButton } from "@/features/auth/auth-portal";
import { CatalogDetailSectionFrame } from "@/features/units/components/catalog-detail-section-frame";
import { useCatalogDetail } from "@/features/units/components/catalog-detail-workspace";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { TagVoteControls } from "../components/tag-vote-controls";
import { TagStructurePath } from "../components/tag-structure-path";
import { tagSearchHref, tagStructureHref } from "../routing/tag-links";

interface PickedTag {
	readonly id: string;
	readonly label: string;
}

export function UnitTagsPage() {
	const detail = useCatalogDetail();
	const { data: session } = useHydratedSession();
	const { locale, t } = useTranslation(["tags", "ui", "units"]);
	const queryClient = useQueryClient();
	const [selectedTag, setSelectedTag] = useState<PickedTag>();
	const [selectedStructure, setSelectedStructure] = useState<PickedTag>();
	const language = toContentLanguage(locale.target);
	const queryInput = {
		path: { type: detail.type, unitId: detail.unit.id },
		query: {
			language,
			globalLimit: 100,
			structureLimit: 50,
			sourceLimit: 30,
			perRealmLimit: 50,
		},
	} as const;
	const query = useGetApiUnitsByTypeByUnitIdTags(queryInput);
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: getApiUnitsByTypeByUnitIdTagsQueryKey({
				path: queryInput.path,
			}),
		});
	const add = usePutApiUnitsByTypeByUnitIdTagsByTagId({
		mutation: { onSuccess: invalidate },
	});
	const addStructure = usePutApiUnitsByTypeByUnitIdTagStructuresByStructureId({
		mutation: { onSuccess: invalidate },
	});
	const structureVote = usePutApiUnitsByTypeByUnitIdTagStructuresByStructureIdVote({
		mutation: { onSuccess: invalidate },
	});
	const clearStructureVote = useDeleteApiUnitsByTypeByUnitIdTagStructuresByStructureIdVote({
		mutation: { onSuccess: invalidate },
	});
	const vote = usePutApiUnitsByTypeByUnitIdTagsByTagIdVote({
		mutation: { onSuccess: invalidate },
	});
	const clearVote = useDeleteApiUnitsByTypeByUnitIdTagsByTagIdVote({
		mutation: { onSuccess: invalidate },
	});
	const realmVote = usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote({
		mutation: { onSuccess: invalidate },
	});
	const clearRealmVote = useDeleteApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote({
		mutation: { onSuccess: invalidate },
	});
	const labels =
		detail.type === "book"
			? {
					title: t.units.detail.tabs.book.tags,
					description: t.units.detail.sectionDescriptions.book.tags,
				}
			: detail.type === "media"
				? {
						title: t.units.detail.tabs.media.tags,
						description: t.units.detail.sectionDescriptions.media.tags,
					}
				: {
						title: t.units.detail.tabs.software.tags,
						description: t.units.detail.sectionDescriptions.software.tags,
					};

	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	return (
		<CatalogDetailSectionFrame description={labels.description} title={labels.title}>
			<section className="grid gap-3">
				<div className="grid gap-1">
					<h2 className="font-heading text-xl font-bold">{t.tags.structures.title}</h2>
					<p className="text-sm text-muted-foreground">{t.tags.structures.description}</p>
				</div>
				<Card>
					<CardContent className="grid gap-3 p-5">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div className="grid gap-1">
								<h3 className="font-semibold">{t.tags.structures.addTitle}</h3>
								<p className="text-sm text-muted-foreground">
									{t.tags.structures.addDescription}
								</p>
							</div>
							<Button asChild variant="outline">
								<Link href="/tag-structures/new">{t.tags.structures.create}</Link>
							</Button>
						</div>
						{session ? (
							<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
								<EntityPicker
									index="tag-structures"
									onChange={setSelectedStructure}
									value={selectedStructure}
								/>
								<Button
									disabled={!selectedStructure}
									isLoading={addStructure.isPending}
									onClick={() => {
										if (!selectedStructure) return;
										void addStructure
											.mutateAsync({
												path: {
													type: detail.type,
													unitId: detail.unit.id,
													structureId: selectedStructure.id,
												},
											})
											.then(() => setSelectedStructure(undefined))
											.catch(() => undefined);
									}}
									type="button"
								>
									{t.tags.structures.add}
								</Button>
							</div>
						) : (
							<SignInButton variant="outline">{t.tags.structures.add}</SignInButton>
						)}
						<RequestFailure error={addStructure.error} fallback={t.ui.retryLater} />
					</CardContent>
				</Card>
				{query.data.structures.length ? (
					<div className="grid gap-3">
						{query.data.structures.map((structure) => {
							const isPending =
								(structureVote.isPending &&
									structureVote.variables?.path.structureId ===
										structure.structureId) ||
								(clearStructureVote.isPending &&
									clearStructureVote.variables?.path.structureId ===
										structure.structureId);
							return (
								<Card key={structure.structureId}>
									<CardContent className="grid gap-4 p-4 sm:p-5">
										<div className="flex flex-wrap items-start justify-between gap-3">
											<TagStructurePath
												ariaLabel={t.tags.structures.pathLabel}
												fallback={t.tags.structures.memberFallback}
												members={structure.members}
											/>
											<Link
												className="text-sm text-link hover:text-link-hover hover:underline"
												href={tagStructureHref(structure.structureId)}
											>
												{t.tags.page.viewAll}
											</Link>
										</div>
										<TagVoteControls
											canVote={Boolean(session)}
											isPending={isPending}
											onClear={() =>
												clearStructureVote.mutate({
													path: {
														type: detail.type,
														unitId: detail.unit.id,
														structureId: structure.structureId,
													},
												})
											}
											onVote={(value) =>
												structureVote.mutate({
													path: {
														type: detail.type,
														unitId: detail.unit.id,
														structureId: structure.structureId,
													},
													body: { value },
												})
											}
											score={toFiniteApiNumber(structure.score) ?? 0}
											viewerVote={structure.viewerVote}
											voteCount={toNonNegativeApiInteger(structure.voteCount)}
										/>
									</CardContent>
								</Card>
							);
						})}
					</div>
				) : (
					<p className="text-sm text-muted-foreground">{t.tags.structures.empty}</p>
				)}
				<RequestFailure
					error={structureVote.error ?? clearStructureVote.error}
					fallback={t.ui.retryLater}
				/>
			</section>

			<section className="grid gap-3">
				<div className="grid gap-1">
					<h2 className="font-heading text-xl font-bold">{t.tags.global.title}</h2>
					<p className="text-sm text-muted-foreground">{t.tags.global.description}</p>
				</div>
				<Card>
					<CardContent className="grid gap-3 p-5">
						<div className="grid gap-1">
							<h3 className="font-semibold">{t.tags.global.addTitle}</h3>
							<p className="text-sm text-muted-foreground">
								{t.tags.global.addDescription}
							</p>
						</div>
						{session ? (
							<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
								<EntityPicker
									index="tags"
									onChange={setSelectedTag}
									value={selectedTag}
								/>
								<Button
									disabled={!selectedTag}
									isLoading={add.isPending}
									onClick={() => {
										if (!selectedTag) return;
										void add
											.mutateAsync({
												path: {
													type: detail.type,
													unitId: detail.unit.id,
													tagId: selectedTag.id,
												},
												body: {},
											})
											.then(() => setSelectedTag(undefined))
											.catch(() => undefined);
									}}
									type="button"
								>
									{t.tags.global.add}
								</Button>
							</div>
						) : (
							<SignInButton variant="outline">{t.tags.global.add}</SignInButton>
						)}
						<RequestFailure error={add.error} fallback={t.ui.retryLater} />
					</CardContent>
				</Card>

				{query.data.global.length ? (
					<div className="grid gap-3">
						{query.data.global.map((tag) => {
							const label = tag.title ?? t.tags.unnamedTag;
							const isPending =
								(vote.isPending && vote.variables?.path.tagId === tag.tagId) ||
								(clearVote.isPending &&
									clearVote.variables?.path.tagId === tag.tagId);
							return (
								<Card key={tag.tagId}>
									<CardContent className="grid gap-3 p-4 sm:p-5">
										<div className="flex flex-wrap items-start justify-between gap-3">
											<div className="grid min-w-0 gap-1">
												<Link
													className="font-semibold text-link hover:text-link-hover hover:underline"
													href={tagSearchHref(
														detail.type,
														tag.tagId,
														label,
													)}
												>
													{label}
												</Link>
												{tag.summary ? (
													<p className="text-sm text-muted-foreground">
														{tag.summary}
													</p>
												) : null}
											</div>
											{tag.pinned ? (
												<Badge variant="secondary">
													{t.tags.global.pinned}
												</Badge>
											) : null}
										</div>
										<TagVoteControls
											canVote={Boolean(session)}
											isPending={isPending}
											onClear={() =>
												clearVote.mutate({
													path: {
														type: detail.type,
														unitId: detail.unit.id,
														tagId: tag.tagId,
													},
												})
											}
											onVote={(value) =>
												vote.mutate({
													path: {
														type: detail.type,
														unitId: detail.unit.id,
														tagId: tag.tagId,
													},
													body: { value },
												})
											}
											score={toFiniteApiNumber(tag.score) ?? 0}
											viewerVote={tag.viewerVote}
											voteCount={toNonNegativeApiInteger(tag.voteCount)}
										/>
									</CardContent>
								</Card>
							);
						})}
					</div>
				) : (
					<p className="text-sm text-muted-foreground">{t.tags.global.empty}</p>
				)}
				<RequestFailure error={vote.error ?? clearVote.error} fallback={t.ui.retryLater} />
			</section>

			<section className="grid gap-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="grid gap-1">
						<h2 className="font-heading text-xl font-bold">{t.tags.realms.title}</h2>
						<p className="max-w-3xl text-sm text-muted-foreground">
							{t.tags.realms.description}
						</p>
					</div>
					<Button asChild variant="outline">
						<Link href="/settings/tag-sources">{t.tags.sources.manage}</Link>
					</Button>
				</div>

				{query.data.realms.some(
					(source) => source.votedTags.length || source.policyTags.length,
				) ? (
					query.data.realms.map((source) => {
						if (!source.votedTags.length && !source.policyTags.length) return null;
						return (
							<Card key={source.realmId}>
								<CardContent className="grid gap-5 p-5 sm:p-6">
									<div className="grid gap-1">
										<h3 className="font-heading text-lg font-bold">
											{source.title ?? t.tags.unnamedRealm}
										</h3>
										{source.summary ? (
											<p className="text-sm text-muted-foreground">
												{source.summary}
											</p>
										) : null}
									</div>
									{source.policyTags.length ? (
										<div className="grid gap-2">
											<h4 className="text-sm font-semibold">
												{t.tags.realms.policy}
											</h4>
											<div className="flex flex-wrap gap-2">
												{source.policyTags.map((tag) => {
													const label = tag.title ?? t.tags.unnamedTag;
													return (
														<Link
															href={tagSearchHref(
																detail.type,
																tag.tagId,
																label,
															)}
															key={tag.tagId}
														>
															<Badge variant="secondary">
																{label}
															</Badge>
														</Link>
													);
												})}
											</div>
										</div>
									) : null}
									{source.votedTags.length ? (
										<div className="grid gap-3">
											<h4 className="text-sm font-semibold">
												{t.tags.realms.votes}
											</h4>
											{source.votedTags.map((tag) => {
												const label = tag.title ?? t.tags.unnamedTag;
												const isPending =
													(realmVote.isPending &&
														realmVote.variables?.path.realmId ===
															source.realmId &&
														realmVote.variables.path.tagId ===
															tag.tagId) ||
													(clearRealmVote.isPending &&
														clearRealmVote.variables?.path.realmId ===
															source.realmId &&
														clearRealmVote.variables.path.tagId ===
															tag.tagId);
												return (
													<div
														className="grid gap-3 border-t border-border-weak pt-3 first:border-0 first:pt-0"
														key={tag.tagId}
													>
														<div className="flex flex-wrap items-start justify-between gap-3">
															<Link
																className="font-semibold text-link hover:text-link-hover hover:underline"
																href={tagSearchHref(
																	detail.type,
																	tag.tagId,
																	label,
																)}
															>
																{label}
															</Link>
															<Link
																className="text-xs text-link hover:text-link-hover hover:underline"
																href={`/posts/${tag.contextPostId}`}
															>
																{t.tags.realms.context}
															</Link>
														</div>
														{tag.summary ? (
															<p className="text-sm text-muted-foreground">
																{tag.summary}
															</p>
														) : null}
														<TagVoteControls
															canVote={source.canVote}
															isPending={isPending}
															onClear={() =>
																clearRealmVote.mutate({
																	path: {
																		realmId: source.realmId,
																		unitId: detail.unit.id,
																		tagId: tag.tagId,
																	},
																})
															}
															onVote={(value) =>
																realmVote.mutate({
																	path: {
																		realmId: source.realmId,
																		unitId: detail.unit.id,
																		tagId: tag.tagId,
																	},
																	body: { value },
																})
															}
															score={
																toFiniteApiNumber(tag.score) ?? 0
															}
															viewerVote={tag.viewerVote}
															voteCount={toNonNegativeApiInteger(
																tag.voteCount,
															)}
														/>
														{!source.canVote ? (
															<p className="text-xs text-muted-foreground">
																{t.tags.realms.cannotVote}
															</p>
														) : null}
													</div>
												);
											})}
										</div>
									) : null}
								</CardContent>
							</Card>
						);
					})
				) : (
					<p className="text-sm text-muted-foreground">{t.tags.realms.empty}</p>
				)}
				<RequestFailure
					error={realmVote.error ?? clearRealmVote.error}
					fallback={t.ui.retryLater}
				/>
			</section>
		</CatalogDetailSectionFrame>
	);
}
