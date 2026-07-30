"use client";

import {
	Alert,
	AlertDescription,
	AlertTitle,
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@rezics/ui";
import { CircleCheck, Search } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { publicEntrySearchHref, type PublicEntrySearchSubject } from "../model/public-entry-search";

/** Links a public-entry form to its exact catalog duplicate search. */
export function PublicEntrySearchPrompt({
	confirmed,
	query,
	subject,
}: {
	readonly confirmed: boolean;
	readonly query: string;
	readonly subject: PublicEntrySearchSubject;
}) {
	const { t } = useTranslation("create");
	const messages = t.publicEntrySearch;
	const subjectLabel = messages.subjects[subject.kind];
	const Icon = confirmed ? CircleCheck : Search;

	return (
		<Alert variant={confirmed ? "success" : "warning"}>
			<Icon aria-hidden />
			<AlertTitle>
				{confirmed
					? messages.confirmedTitle({ subject: subjectLabel })
					: messages.requiredTitle}
			</AlertTitle>
			<AlertDescription>
				<HoverCard
					closeDelay={160}
					openDelay={400}
					positioning={{ placement: "bottom-start" }}
				>
					<HoverCardTrigger asChild>
						<Link
							className="w-fit rounded-sm font-medium text-foreground underline decoration-current/40 underline-offset-4 outline-none hover:decoration-current focus-visible:ring-[3px] focus-visible:ring-ring/32"
							href={publicEntrySearchHref(subject, query)}
						>
							{messages.prompt({ subject: subjectLabel })}
						</Link>
					</HoverCardTrigger>
					<HoverCardContent className="w-[min(24rem,calc(100vw-2rem))]">
						<p className="text-sm leading-6">{messages.policy}</p>
					</HoverCardContent>
				</HoverCard>
				{confirmed ? (
					<p>{messages.confirmedDescription}</p>
				) : (
					<p>{messages.requiredDescription}</p>
				)}
			</AlertDescription>
		</Alert>
	);
}
