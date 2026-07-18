"use client";

import {
	type GetApiReviewsByReviewIdStatus200,
	getApiReactionsUnitsByUnitIdQueryKey,
	getApiReviewsByReviewIdQueryKey,
	getApiReviewsQueryKey,
	getApiScoresByTargetIdQueryKey,
	useDeleteApiReactionsUnitsByUnitId,
	useDeleteApiReviewsByReviewId,
	useGetApiReactionsUnitsByUnitId,
	useGetApiReviews,
	useGetApiReviewsByReviewId,
	useGetApiScoresByTargetId,
	usePatchApiReviewsByReviewId,
	usePostApiReviews,
	usePutApiReactionsUnitsByUnitId,
	usePutApiScoresByTargetId,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { EntityPicker } from "@rezics/ui";
import { PageHeading } from "@rezics/ui";
import { PortableTextContent } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogBody,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent, CardHeader } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { SignInButton } from "@/features/auth/auth-portal";
import { RequireSession } from "@/features/auth/require-session";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/content-structure";
import { useHydratedSession } from "@/lib/use-hydrated-session";

async function invalidateReviews(
	queryClient: ReturnType<typeof useQueryClient>,
	reviewId?: string,
) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: getApiReviewsQueryKey() }),
		...(reviewId
			? [
					queryClient.invalidateQueries({
						queryKey: getApiReviewsByReviewIdQueryKey({ path: { reviewId } }),
					}),
				]
			: []),
	]);
}

export function ReviewsPage() {
	const query = useGetApiReviews({ query: { limit: 50 } });
	const { t } = useTranslation({ suspense: true });
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={t.engagement.reviews}
				action={
					<Button asChild>
						<Link href="/reviews/new">{t.engagement.newReview}</Link>
					</Button>
				}
			/>
			{query.data?.items.length ? (
				<div className="grid gap-3">
					{query.data.items.map((review) => (
						<Link key={review.id} href={`/reviews/${review.id}`}>
							<Card className="transition-colors hover:border-primary/30">
								<CardHeader
									description={review.summary ?? undefined}
									title={review.title ?? t.ui.unnamed}
								/>
								<CardContent className="text-muted-foreground text-sm">
									{review.authorName ?? t.engagement.unknownAuthor}
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{t.engagement.emptyReviews}</p>
			)}
		</main>
	);
}

export function ReviewCreate() {
	const create = usePostApiReviews();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { locale, t } = useTranslation({ suspense: true });
	const [target, setTarget] = useState<{ id: string; label: string }>();
	const [realm, setRealm] = useState<{ id: string; label: string }>();
	const [body, setBody] = useState<PortableTextValue>([]);
	const [invalid, setInvalid] = useState(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!target || !body.length) {
			setInvalid(true);
			return;
		}
		const form = new FormData(event.currentTarget);
		const scoreValue = String(form.get("score") ?? "").trim();
		if (scoreValue && !realm) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		try {
			const result = await create.mutateAsync({
				body: {
					targetId: target.id,
					...(realm ? { realmId: realm.id } : {}),
					language: locale.target,
					title: String(form.get("title") ?? "").trim(),
					...(String(form.get("summary") ?? "").trim()
						? { summary: String(form.get("summary") ?? "").trim() }
						: {}),
					body: writePortableText(body),
					...(scoreValue ? { score: Number(scoreValue) } : {}),
				},
			});
			await invalidateReviews(queryClient, result.id);
			router.push(`/reviews/${result.id}`);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.engagement.newReview} />
				<form className="flex flex-col gap-6" onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.engagement.reviewTarget}</FieldLabel>
							<EntityPicker index="units" onChange={setTarget} value={target} />
						</Field>
						<Field>
							<FieldLabel>{t.engagement.reviewRealm}</FieldLabel>
							<EntityPicker index="realms" onChange={setRealm} value={realm} />
						</Field>
						<Field required>
							<FieldLabel>{t.ui.title}</FieldLabel>
							<Input maxLength={500} name="title" required />
						</Field>
						<Field>
							<FieldLabel>{t.ui.summary}</FieldLabel>
							<Input maxLength={2000} name="summary" />
						</Field>
						<Field>
							<FieldLabel>{t.engagement.reviewScore}</FieldLabel>
							<Input max={10} min={1} name="score" type="number" />
						</Field>
						<PortableTextEditor
							label={t.ui.body}
							onChange={setBody}
							required
							value={body}
						/>
					</FieldGroup>
					{invalid && <p className="text-destructive text-sm">{t.errors.invalid}</p>}
					<RequestFailure error={create.error} fallback={t.ui.retryLater} />
					<Button
						disabled={!target || !body.length}
						isLoading={create.isPending}
						type="submit"
					>
						{t.ui.create}
					</Button>
				</form>
			</main>
		</RequireSession>
	);
}

export function ReviewDetail({ id }: { id: string }) {
	const query = useGetApiReviewsByReviewId({ path: { reviewId: id } });
	const remove = useDeleteApiReviewsByReviewId();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { t } = useTranslation({ suspense: true });
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return null;
	const review = query.data;
	async function deleteReview() {
		try {
			await remove.mutateAsync({ path: { reviewId: id } });
			await invalidateReviews(queryClient, id);
			router.push("/reviews");
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={review.title ?? t.ui.unnamed}
				description={review.summary ?? undefined}
				action={
					review.capabilities.canEdit ? (
						<div className="flex shrink-0 flex-wrap gap-2">
							<Button asChild variant="outline">
								<Link href={`/reviews/${id}/edit`}>{t.ui.edit}</Link>
							</Button>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button variant="destructive">
										{t.engagement.deleteReview}
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											{t.engagement.deleteReview}
										</AlertDialogTitle>
									</AlertDialogHeader>
									<AlertDialogBody>
										<AlertDialogDescription>
											{t.engagement.deleteReviewPrompt}
										</AlertDialogDescription>
									</AlertDialogBody>
									<AlertDialogFooter>
										<AlertDialogCancel>{t.engagement.cancel}</AlertDialogCancel>
										<AlertDialogAction
											isLoading={remove.isPending}
											onClick={() => void deleteReview()}
											variant="destructive"
										>
											{t.engagement.delete}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>
					) : undefined
				}
			/>
			{review.body && (
				<Card>
					<CardContent className="prose max-w-none py-2">
						<PortableTextContent
							value={readPortableText(review.body)}
							variant="article"
						/>
					</CardContent>
				</Card>
			)}
			{review.realmId && <ScorePanel realmId={review.realmId} targetId={review.targetId} />}
			<ReactionControls targetId={review.id} />
			<RequestFailure error={remove.error} fallback={t.ui.retryLater} />
		</main>
	);
}

export function ReviewEdit({ id }: { id: string }) {
	const query = useGetApiReviewsByReviewId({ path: { reviewId: id } });
	const { t } = useTranslation({ suspense: true });
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return null;
	if (!query.data.capabilities.canEdit)
		return (
			<main className="mx-auto grid min-h-64 w-full max-w-4xl place-items-center px-4 py-10">
				<p className="text-destructive text-sm">{t.errors.forbidden}</p>
			</main>
		);
	return <ReviewEditForm review={query.data} reviewId={id} />;
}

function ReviewEditForm({
	review,
	reviewId,
}: {
	review: GetApiReviewsByReviewIdStatus200;
	reviewId: string;
}) {
	const update = usePatchApiReviewsByReviewId();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { locale, t } = useTranslation({ suspense: true });
	const [body, setBody] = useState<PortableTextValue>(() => readPortableText(review.body));
	const [invalid, setInvalid] = useState(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!body.length) {
			setInvalid(true);
			return;
		}
		const form = new FormData(event.currentTarget);
		setInvalid(false);
		try {
			await update.mutateAsync({
				path: { reviewId },
				body: {
					language: locale.target,
					title: String(form.get("title") ?? "").trim(),
					...(String(form.get("summary") ?? "").trim()
						? { summary: String(form.get("summary") ?? "").trim() }
						: {}),
					body: writePortableText(body, review.body),
				},
			});
			await invalidateReviews(queryClient, reviewId);
			router.push(`/reviews/${reviewId}`);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.engagement.editReview} />
				<form className="flex flex-col gap-6" onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.ui.title}</FieldLabel>
							<Input
								defaultValue={review.title ?? ""}
								maxLength={500}
								name="title"
								required
							/>
						</Field>
						<Field>
							<FieldLabel>{t.ui.summary}</FieldLabel>
							<Input
								defaultValue={review.summary ?? ""}
								maxLength={2000}
								name="summary"
							/>
						</Field>
						<PortableTextEditor
							label={t.ui.body}
							onChange={setBody}
							required
							value={body}
						/>
					</FieldGroup>
					{invalid && <p className="text-destructive text-sm">{t.errors.invalid}</p>}
					<RequestFailure error={update.error} fallback={t.ui.retryLater} />
					<Button isLoading={update.isPending} type="submit">
						{t.ui.save}
					</Button>
				</form>
			</main>
		</RequireSession>
	);
}

function ScorePanel({ targetId, realmId }: { targetId: string; realmId: string }) {
	const aggregate = useGetApiScoresByTargetId({
		path: { targetId },
		query: { realmId },
	});
	const setScore = usePutApiScoresByTargetId();
	const queryClient = useQueryClient();
	const { data: session } = useHydratedSession();
	const { t } = useTranslation({ suspense: true });
	const [score, setScoreValue] = useState("5");
	const count = Number(aggregate.data?.totalCount ?? 0);
	const average = count ? Number(aggregate.data?.totalScore ?? 0) / count : 0;
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		try {
			await setScore.mutateAsync({
				path: { targetId },
				body: { realmId, score: Number(score) },
			});
			await queryClient.invalidateQueries({
				queryKey: getApiScoresByTargetIdQueryKey({
					path: { targetId },
					query: { realmId },
				}),
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<Card>
			<CardHeader title={t.engagement.scoreAverage} />
			<CardContent className="flex flex-col gap-4">
				{aggregate.isError ? (
					<RequestFailure error={aggregate.error} fallback={t.ui.retryLater} />
				) : (
					<p className="text-muted-foreground text-sm">
						{average.toFixed(1)} · {count} {t.engagement.scoreCount}
					</p>
				)}
				{session ? (
					<form
						className="flex flex-wrap items-end gap-3"
						onSubmit={(event) => void submit(event)}
					>
						<Field className="w-full max-w-32">
							<FieldLabel>{t.engagement.reviewScore}</FieldLabel>
							<Input
								max={10}
								min={1}
								onChange={(event) => setScoreValue(event.currentTarget.value)}
								type="number"
								value={score}
							/>
						</Field>
						<Button isLoading={setScore.isPending} type="submit">
							{t.engagement.setScore}
						</Button>
					</form>
				) : (
					<SignInButton size="sm" variant="outline">
						{t.actions.login}
					</SignInButton>
				)}
				<RequestFailure error={setScore.error} fallback={t.ui.retryLater} />
			</CardContent>
		</Card>
	);
}

function ReactionControls({ targetId }: { targetId: string }) {
	const reactions = useGetApiReactionsUnitsByUnitId({ path: { unitId: targetId } });
	const setReaction = usePutApiReactionsUnitsByUnitId();
	const removeReaction = useDeleteApiReactionsUnitsByUnitId();
	const queryClient = useQueryClient();
	const { data: session } = useHydratedSession();
	const { t } = useTranslation({ suspense: true });
	const [selected, setSelected] = useState<"upvote" | "downvote" | null>(null);
	const counts = new Map(reactions.data?.items.map((item) => [item.reaction, item.count]) ?? []);
	async function change(reaction: "upvote" | "downvote") {
		try {
			if (selected === reaction) {
				await removeReaction.mutateAsync({
					path: { unitId: targetId },
					body: { reaction },
				});
				setSelected(null);
			} else {
				await setReaction.mutateAsync({
					path: { unitId: targetId },
					body: { reaction },
				});
				setSelected(reaction);
			}
			await queryClient.invalidateQueries({
				queryKey: getApiReactionsUnitsByUnitIdQueryKey({
					path: { unitId: targetId },
				}),
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<Card>
			<CardHeader title={t.engagement.reaction} />
			<CardContent className="flex flex-wrap items-center gap-2">
				{session ? (
					<>
						<Button
							isLoading={setReaction.isPending || removeReaction.isPending}
							onClick={() => void change("upvote")}
							variant={selected === "upvote" ? "secondary" : "outline"}
						>
							{t.engagement.upvote} ({counts.get("upvote") ?? 0})
						</Button>
						<Button
							isLoading={setReaction.isPending || removeReaction.isPending}
							onClick={() => void change("downvote")}
							variant={selected === "downvote" ? "secondary" : "outline"}
						>
							{t.engagement.downvote} ({counts.get("downvote") ?? 0})
						</Button>
					</>
				) : (
					<SignInButton size="sm" variant="outline">
						{t.actions.login}
					</SignInButton>
				)}
				<RequestFailure
					error={reactions.error ?? setReaction.error ?? removeReaction.error}
					fallback={t.ui.retryLater}
				/>
			</CardContent>
		</Card>
	);
}
