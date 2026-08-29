import { Button } from "@rezics/ui/ui/button";
import { Sheet, SheetBody, SheetClose, SheetContent, SheetHeader } from "@rezics/ui/ui/sheet";
import type { ReactElement } from "react";
import type { RezicsTextMessages } from "../i18n/messages";

const applicationVersion = "1.0.0";

export function AboutDialog({
	open,
	onOpenChange,
	messages,
}: {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly messages: RezicsTextMessages;
}): ReactElement {
	return (
		<Sheet open={open} onOpenChange={(event) => onOpenChange(event.open)}>
			<SheetContent
				className="mx-auto max-w-md"
				placement="top"
				showCloseButton={false}
				variant="inset"
			>
				<SheetHeader description={messages.productName} title={messages.actions.about} />
				<SheetBody>
					<p className="text-sm">{messages.labels.aboutSummary}</p>
					<p className="mt-2 text-muted-foreground text-sm">
						{messages.labels.version(applicationVersion)}
					</p>
					<div className="mt-4 flex justify-end">
						<SheetClose asChild>
							<Button size="sm" variant="ghost">
								{messages.actions.close}
							</Button>
						</SheetClose>
					</div>
				</SheetBody>
			</SheetContent>
		</Sheet>
	);
}
