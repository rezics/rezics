"use client";
import { StatusCodes } from "http-status-codes";

import { Button } from "@rezics/ui";
import Link from "next/link";
import { useTranslation } from "@/i18n/client";

export default function NotFound() {
	const { t } = useTranslation({ suspense: true });
	return (
		<main className="grid min-h-[60svh] place-items-center px-4 text-center">
			<div>
				<p className="text-primary font-semibold">{StatusCodes.NOT_FOUND}</p>
				<h1 className="mt-2 text-3xl font-bold">{t.routes.notFoundTitle}</h1>
				<p className="text-muted-foreground mt-3">{t.routes.notFoundDescription}</p>
				<Button className="mt-6" asChild>
					<Link href="/">{t.routes.home}</Link>
				</Button>
			</div>
		</main>
	);
}
