"use client";

import { useUiErrorMessage, useUiMessages } from "./ui-provider";
import { Alert, AlertAction, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";

export function QueryPending() {
	const messages = useUiMessages();
	return (
		<main className="mx-auto grid min-h-64 w-full max-w-4xl place-items-center px-4 py-10">
			<div className="text-muted-foreground flex items-center gap-2 text-sm">
				<Spinner />
				{messages.loading}
			</div>
		</main>
	);
}

export function QueryFailure({ error, retry }: { error: unknown; retry: () => void }) {
	const messages = useUiMessages();
	const resolveError = useUiErrorMessage();
	const message = resolveError?.(error) ?? messages.error;
	return (
		<main className="mx-auto grid min-h-64 w-full max-w-4xl place-items-center px-4 py-10 text-center">
			<Alert className="max-w-md text-start" variant="destructive">
				<AlertDescription>{message}</AlertDescription>
				<AlertAction>
					<Button onClick={retry} variant="outline">
						{messages.retry}
					</Button>
				</AlertAction>
			</Alert>
		</main>
	);
}
