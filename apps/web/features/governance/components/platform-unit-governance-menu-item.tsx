"use client";

import { useGetApiUsersMe } from "@rezics/openapi-tanstack-query";
import { MenuItem, MenuSeparator } from "@rezics/ui";
import { ShieldCheck } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { consoleUnitHref } from "@/features/console/routing/console-routes";
import { useTranslation } from "@/i18n/client";

/**
 * Adds the platform-governance entry shared by Unit overflow menus.
 *
 * @alpha
 * @remarks The entry is a navigation affordance only; the Console and every
 * governance API operation enforce their own capability checks.
 */
export function PlatformUnitGovernanceMenuItem({ unitId }: { readonly unitId: string }) {
	const { t } = useTranslation(["governance"]);
	const me = useGetApiUsersMe();
	if (!me.data?.platformCapabilities.includes("unit.governance.read")) return null;

	return (
		<>
			<MenuSeparator />
			<MenuItem asChild value="platform-unit-governance">
				<Link href={consoleUnitHref(unitId)}>
					<ShieldCheck aria-hidden />
					{t.governance.platformOpen}
				</Link>
			</MenuItem>
		</>
	);
}
