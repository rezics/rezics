import { LicenseRegistry, ResidualRightsLicenseId, type LicenseId } from "@rezics/license";
import type { ReactNode } from "react";

import type { Translation } from "@rezics/i18n";

export function presentUnitLicenses(
	licenseIds: readonly LicenseId[],
	t: Pick<Translation, "licenses">,
): ReactNode {
	if (licenseIds.length === 0) return t.licenses.unspecified;
	const residualWithOthers = licenseIds.includes(ResidualRightsLicenseId) && licenseIds.length > 1;
	return (
		<div className="grid gap-2">
			<ul className="grid gap-1">
				{licenseIds.map((licenseId) => {
					const definition = LicenseRegistry[licenseId];
					const label = t.licenses.options[licenseId].label;
					return (
						<li key={licenseId}>
							{definition.termsUrl ? (
								<a
									aria-label={`${t.licenses.viewTerms}: ${label}`}
									className="text-link hover:text-link-hover hover:underline"
									href={definition.termsUrl}
									rel="noreferrer"
									target="_blank"
								>
									{label}
								</a>
							) : (
								label
							)}
						</li>
					);
				})}
			</ul>
			{residualWithOthers ? (
				<p className="text-muted-foreground text-sm">{t.licenses.residualRightsNotice}</p>
			) : null}
		</div>
	);
}
