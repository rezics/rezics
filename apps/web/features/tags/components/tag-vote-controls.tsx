"use client";

import { Button } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";

export function TagVoteControls({
	canVote,
	isPending,
	onClear,
	onVote,
	score,
	viewerVote,
	voteCount,
}: {
	readonly canVote: boolean;
	readonly isPending: boolean;
	readonly onClear: () => void;
	readonly onVote: (value: -1 | 1) => void;
	readonly score: number;
	readonly viewerVote: -1 | 1 | null;
	readonly voteCount: number;
}) {
	const { t } = useTranslation(["tags"]);
	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="me-auto text-xs text-muted-foreground">
				{t.tags.vote.summary({ score: String(score), count: String(voteCount) })}
			</span>
			{canVote ? (
				<>
					<Button
						aria-pressed={viewerVote === 1}
						disabled={isPending}
						onClick={() => onVote(1)}
						size="sm"
						type="button"
						variant={viewerVote === 1 ? "solid" : "outline"}
					>
						{t.tags.vote.fits}
					</Button>
					<Button
						aria-pressed={viewerVote === -1}
						disabled={isPending}
						onClick={() => onVote(-1)}
						size="sm"
						type="button"
						variant={viewerVote === -1 ? "solid" : "outline"}
					>
						{t.tags.vote.doesNotFit}
					</Button>
					{viewerVote !== null ? (
						<Button
							disabled={isPending}
							onClick={onClear}
							size="sm"
							type="button"
							variant="quiet"
						>
							{t.tags.vote.clear}
						</Button>
					) : null}
				</>
			) : null}
		</div>
	);
}
