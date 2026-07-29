"use client";

import { StatusCodes } from "http-status-codes";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { Button } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";

export function ForbiddenPage() {
	const { t } = useTranslation(["routes"]);
	return (
		<main className="grid min-h-[60svh] place-items-center px-4 text-center">
			<div>
				<p className="text-destructive font-semibold">{StatusCodes.FORBIDDEN}</p>
				<h1 className="mt-2 text-3xl font-bold">{t.routes.forbiddenTitle}</h1>
				<p className="text-muted-foreground mt-3">{t.routes.forbiddenDescription}</p>
				<Button variant="solid" className="mt-6" asChild>
					<Link href="/">{t.routes.home}</Link>
				</Button>
			</div>
		</main>
	);
}
