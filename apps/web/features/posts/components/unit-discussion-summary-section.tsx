"use client";

import { Skeleton } from "@rezics/ui";
import { postApiFeedQuery } from "@rezics/openapi-tanstack-query";
import { useQuery } from "@tanstack/react-query";
import { MessageCircleQuestionMark, MessagesSquare, Quote } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { createSubjectFeedPredicate } from "@/features/content-feed/model/subject-feed-filter";
import { FeedQueryKey } from "@/features/content-feed/query";
import type { UnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import {
	unitDetailHref,
	unitExcerptsHref,
	unitQuestionsHref,
} from "@/features/units/routing/unit-detail-routes";
import { useTranslation } from "@/i18n/client";
import { toNonNegativeApiInteger } from "@/lib/api-number";

function useSubjectFeedTotal(kind: "discussion" | "excerpt", subjectId: string) {
	const filter = useMemo(
		() => createSubjectFeedPredicate({ kind, subjectId }),
		[kind, subjectId],
	);
	const body = { filter: { where: filter }, limit: 1, sort: "best" } as const;
	return useQuery({
		queryKey: [...FeedQueryKey, "subject-total", body],
		queryFn: async ({ signal }) => {
			const { data } = await postApiFeedQuery({ body, signal });
			return data;
		},
	});
}

function DiscussionMetric({
	count,
	href,
	icon,
	label,
	pending,
}: {
	readonly count: string;
	readonly href: string;
	readonly icon: ReactNode;
	readonly label: string;
	readonly pending?: boolean;
}) {
	return (
		<Link
			className="group grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 rounded-xl px-3 py-4 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
			href={href}
		>
			<span
				aria-hidden
				className="grid size-[4.5rem] place-items-center rounded-full bg-surface-muted text-brand"
			>
				{icon}
			</span>
			<span className="grid min-w-0 gap-0.5">
				{pending ? (
					<Skeleton className="h-10 w-20" />
				) : (
					<strong className="font-heading text-4xl tabular-nums">{count}</strong>
				)}
				<span className="inline-flex items-center gap-1 text-sm text-muted-foreground group-hover:text-foreground">
					{label}
					<span aria-hidden>›</span>
				</span>
			</span>
		</Link>
	);
}

export function UnitDiscussionSummarySection({
	targetId,
	type,
}: {
	readonly targetId: string;
	readonly type: UnitDetailUnitType;
}) {
	const { locale, t } = useTranslation(["engagement"]);
	const excerpts = useSubjectFeedTotal("excerpt", targetId);
	const discussions = useSubjectFeedTotal("discussion", targetId);
	const numberFormat = new Intl.NumberFormat(locale.current);
	const displayTotal = (
		total:
			| Readonly<{
					readonly relation: "exact" | "lower-bound";
					readonly value: string | number;
			  }>
			| undefined,
	) =>
		total
			? total.relation === "lower-bound"
				? t.engagement.atLeastCount({
						count: numberFormat.format(toNonNegativeApiInteger(total.value)),
					})
				: numberFormat.format(toNonNegativeApiInteger(total.value))
			: numberFormat.format(0);

	return (
		<section className="grid gap-4 pt-8">
			<h2 className="font-heading text-2xl font-bold sm:text-3xl">
				{t.engagement.joinDiscussion}
			</h2>
			<div className="grid gap-2 sm:grid-cols-3">
				<DiscussionMetric
					count={displayTotal(excerpts.data?.total)}
					href={unitExcerptsHref(type, targetId)}
					icon={<Quote className="size-9" />}
					label={t.engagement.excerpts}
					pending={excerpts.isPending}
				/>
				<DiscussionMetric
					count={displayTotal(discussions.data?.total)}
					href={unitDetailHref(type, targetId, "discussion")}
					icon={<MessagesSquare className="size-9" />}
					label={t.engagement.discussions}
					pending={discussions.isPending}
				/>
				<DiscussionMetric
					count={numberFormat.format(0)}
					href={unitQuestionsHref(type, targetId)}
					icon={<MessageCircleQuestionMark className="size-9" />}
					label={t.engagement.questions}
				/>
			</div>
		</section>
	);
}
