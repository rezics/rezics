"use client";

import { Button } from "@rezics/ui";
import { CheckCircle2, Flag } from "lucide-react";

export function CompleteProgressButton({
	completedLabel,
	isCompleting,
	label,
	onClick,
}: {
	readonly completedLabel: string;
	readonly isCompleting: boolean;
	readonly label: string;
	readonly onClick: () => void;
}) {
	return (
		<Button
			aria-busy={isCompleting}
			className="min-h-11 min-w-40 overflow-hidden"
			disabled={isCompleting}
			onClick={onClick}
			variant="brand"
		>
			{isCompleting ? (
				<CheckCircle2
					aria-hidden
					className="animate-in zoom-in-75 fade-in duration-300 motion-reduce:animate-none"
				/>
			) : (
				<Flag aria-hidden />
			)}
			<span
				className={
					isCompleting
						? "animate-in slide-in-from-bottom-2 fade-in duration-300 motion-reduce:animate-none"
						: undefined
				}
				key={isCompleting ? completedLabel : label}
			>
				{isCompleting ? completedLabel : label}
			</span>
		</Button>
	);
}
