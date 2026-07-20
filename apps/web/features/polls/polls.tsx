"use client";

import { toContentLanguage } from "@rezics/i18n";

import {
	getApiPollsByPollIdQueryKey,
	postApiSearchByIndex,
	useDeleteApiPollsByPollIdVote,
	useGetApiPollsByPollId,
	usePostApiPolls,
	usePutApiPollsByPollIdVote,
} from "@rezics/openapi-tanstack-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent, CardHeader } from "@rezics/ui";
import { Checkbox, CheckboxGroup } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { RadioGroup, RadioGroupItem } from "@rezics/ui";
import { SignInButton } from "@/features/auth/auth-portal";
import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";

const PollSearch = { query: "", limit: 50, sort: "createdAt:desc" as const };
const PollSearchQueryKey = [{ url: "/api/search/polls" }, PollSearch] as const;

export function PollsPage() {
	const query = useQuery({
		queryKey: PollSearchQueryKey,
		queryFn: async ({ signal }) => {
			const { data } = await postApiSearchByIndex({
				path: { index: "polls" },
				body: PollSearch,
				signal,
			});
			return data;
		},
	});
	const { t } = useTranslation(["actions", "engagement", "errors", "ui"]);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={t.engagement.polls}
				action={
					<Button asChild>
						<Link href="/polls/new">{t.engagement.newPoll}</Link>
					</Button>
				}
			/>
			{query.data.hits.length ? (
				<div className="grid gap-3">
					{query.data.hits.map((poll) => (
						<Link key={poll.id} href={`/polls/${poll.id}`}>
							<Card className="transition-colors hover:bg-surface-hover">
								<CardHeader
									description={poll.summaries[0] ?? undefined}
									title={poll.titles[0] ?? t.ui.unnamed}
								/>
							</Card>
						</Link>
					))}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{t.engagement.emptyPolls}</p>
			)}
		</main>
	);
}

export function PollCreate() {
	const create = usePostApiPolls();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { locale, t } = useTranslation(["actions", "engagement", "errors", "ui"]);
	const [options, setOptions] = useState([
		{ key: crypto.randomUUID(), label: "" },
		{ key: crypto.randomUUID(), label: "" },
	]);
	const [invalid, setInvalid] = useState(false);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const question = String(form.get("question") ?? "").trim();
		const labels = options.map((option) => option.label.trim()).filter(Boolean);
		const uniqueLabels = new Set(labels.map((option) => option.toLocaleLowerCase()));
		if (
			!question ||
			labels.length < 2 ||
			labels.length !== options.length ||
			uniqueLabels.size !== labels.length
		) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		const voteMode = form.get("voteMode") === "multiple" ? "multiple" : "single";
		const resultsVisibility =
			form.get("resultsVisibility") === "after_close" ? "after_close" : "live";
		try {
			const result = await create.mutateAsync({
				body: {
					question,
					language: toContentLanguage(locale.target),
					options: labels,
					voteMode,
					anonymous: form.get("anonymous") === "on",
					resultsVisibility,
					...(String(form.get("closesAt") ?? "")
						? { closesAt: new Date(String(form.get("closesAt"))).toISOString() }
						: {}),
				},
			});
			await queryClient.invalidateQueries({
				queryKey: PollSearchQueryKey,
			});
			router.push(`/polls/${result.id}`);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.engagement.newPoll} />
				<form className="flex flex-col gap-6" onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<Field required>
							<FieldLabel>{t.engagement.pollQuestion}</FieldLabel>
							<Input maxLength={500} name="question" required />
						</Field>
						<Field>
							<FieldLabel>{t.engagement.pollOptions}</FieldLabel>
							<div className="flex flex-col gap-2">
								{options.map((option, index) => (
									<div className="flex items-center gap-2" key={option.key}>
										<Input
											aria-label={`${t.engagement.pollOptions} ${index + 1}`}
											maxLength={500}
											onChange={(event) =>
												setOptions((current) =>
													current.map((candidate) =>
														candidate.key === option.key
															? {
																	...candidate,
																	label: event.currentTarget
																		.value,
																}
															: candidate,
													),
												)
											}
											value={option.label}
										/>
										<Button
											disabled={options.length <= 2}
											size="sm"
											type="button"
											variant="ghost"
											onClick={() =>
												setOptions((current) =>
													current.filter(
														(candidate) => candidate.key !== option.key,
													),
												)
											}
										>
											{t.engagement.removeOption}
										</Button>
									</div>
								))}
								<Button
									disabled={options.length >= 50}
									size="sm"
									type="button"
									variant="outline"
									onClick={() =>
										setOptions((current) => [
											...current,
											{ key: crypto.randomUUID(), label: "" },
										])
									}
								>
									{t.engagement.addOption}
								</Button>
							</div>
						</Field>
						<Field>
							<FieldLabel>{t.engagement.polls}</FieldLabel>
							<NativeSelect defaultValue="single" name="voteMode">
								<NativeSelectOption value="single">
									{t.engagement.singleChoice}
								</NativeSelectOption>
								<NativeSelectOption value="multiple">
									{t.engagement.multipleChoice}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.engagement.resultVisibility}</FieldLabel>
							<NativeSelect defaultValue="live" name="resultsVisibility">
								<NativeSelectOption value="live">
									{t.engagement.resultsLive}
								</NativeSelectOption>
								<NativeSelectOption value="after_close">
									{t.engagement.resultsAfterClose}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.engagement.closesAt}</FieldLabel>
							<Input name="closesAt" type="datetime-local" />
						</Field>
						<Field orientation="horizontal">
							<Checkbox name="anonymous" />
							<FieldLabel className="font-normal">
								{t.engagement.anonymous}
							</FieldLabel>
						</Field>
					</FieldGroup>
					{invalid && <p className="text-destructive text-sm">{t.errors.invalid}</p>}
					<RequestFailure error={create.error} fallback={t.ui.retryLater} />
					<Button isLoading={create.isPending} type="submit">
						{t.ui.create}
					</Button>
				</form>
			</main>
		</RequireSession>
	);
}

export function PollDetail({ id }: { id: string }) {
	const poll = useGetApiPollsByPollId({ path: { pollId: id } });
	const vote = usePutApiPollsByPollIdVote();
	const retract = useDeleteApiPollsByPollIdVote();
	const queryClient = useQueryClient();
	const { data: session } = useHydratedSession();
	const { t } = useTranslation(["actions", "engagement", "errors", "ui"]);
	const [selected, setSelected] = useState<string[]>([]);
	useEffect(() => {
		if (poll.data) setSelected(poll.data.viewerOptionIds);
	}, [poll.data]);
	if (poll.isPending) return <QueryPending />;
	if (poll.isError) return <QueryFailure error={poll.error} retry={() => void poll.refetch()} />;
	if (!poll.data) return null;
	const currentPoll = poll.data;
	const hasVoted = currentPoll.viewerOptionIds.length > 0;
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!session || currentPoll.closed || !selected.length) return;
		try {
			await vote.mutateAsync({ path: { pollId: id }, body: { optionIds: selected } });
			await queryClient.invalidateQueries({
				queryKey: getApiPollsByPollIdQueryKey({ path: { pollId: id } }),
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	async function withdraw() {
		try {
			await retract.mutateAsync({ path: { pollId: id } });
			setSelected([]);
			await queryClient.invalidateQueries({
				queryKey: getApiPollsByPollIdQueryKey({ path: { pollId: id } }),
			});
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={currentPoll.question} />
			<Card>
				<CardContent className="flex flex-col gap-4">
					<form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
						{currentPoll.voteMode === "single" ? (
							<RadioGroup
								className="gap-3"
								disabled={!session || currentPoll.closed}
								name="option"
								onValueChange={({ value }) => setSelected(value ? [value] : [])}
								value={selected[0] ?? ""}
							>
								{currentPoll.options.map((option) => (
									<PollOption
										count={
											option.voteCount === null
												? null
												: Number(option.voteCount)
										}
										key={option.id}
										option={option}
										variant="radio"
									/>
								))}
							</RadioGroup>
						) : (
							<CheckboxGroup
								className="gap-3"
								disabled={!session || currentPoll.closed}
								onValueChange={setSelected}
								value={selected}
							>
								{currentPoll.options.map((option) => (
									<PollOption
										count={
											option.voteCount === null
												? null
												: Number(option.voteCount)
										}
										key={option.id}
										option={option}
										variant="checkbox"
									/>
								))}
							</CheckboxGroup>
						)}
						{currentPoll.options.some((option) => option.voteCount === null) && (
							<p className="text-muted-foreground text-sm">
								{t.engagement.resultsHidden}
							</p>
						)}
						{currentPoll.closed ? (
							<p className="text-muted-foreground text-sm">
								{t.engagement.pollClosed}
							</p>
						) : session ? (
							<div className="flex flex-wrap gap-2">
								<Button
									disabled={!selected.length}
									isLoading={vote.isPending}
									type="submit"
								>
									{hasVoted ? t.engagement.updateVote : t.engagement.vote}
								</Button>
								{hasVoted && (
									<Button
										isLoading={retract.isPending}
										onClick={() => void withdraw()}
										variant="outline"
									>
										{t.engagement.retractVote}
									</Button>
								)}
							</div>
						) : (
							<SignInButton destination={`/polls/${id}`}>
								{t.actions.login}
							</SignInButton>
						)}
					</form>
					<RequestFailure
						error={vote.error ?? retract.error}
						fallback={t.ui.retryLater}
					/>
				</CardContent>
			</Card>
		</main>
	);
}

function PollOption({
	count,
	option,
	variant,
}: {
	count: number | null;
	option: { id: string; label: string };
	variant: "checkbox" | "radio";
}) {
	return (
		<Field className="rounded-lg border p-3" orientation="horizontal">
			{variant === "radio" ? (
				<RadioGroupItem className="min-w-0 flex-1" value={option.id}>
					<span className="min-w-0 flex-1 truncate">{option.label}</span>
				</RadioGroupItem>
			) : (
				<>
					<Checkbox value={option.id} />
					<FieldLabel className="min-w-0 flex-1 truncate font-normal">
						{option.label}
					</FieldLabel>
				</>
			)}
			{count !== null && (
				<span className="shrink-0 text-muted-foreground text-sm">{count}</span>
			)}
		</Field>
	);
}
