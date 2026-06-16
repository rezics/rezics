import { unitExternalRefListQueryOptions } from "@rezics/api/unit-external-ref";
import type { ZoneSourcesSection } from "@rezics/contract";
import { Skeleton } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { QueryErrorDisplay } from "@/core";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { sourceSiteLabel } from "../../models/sourceSiteLabel";
import {
  useZoneSectionTitle,
  type ZonePortalContext,
  ZoneSectionEmpty,
  ZoneSectionShell,
} from "./shared";

/**
 * Sources is a thin reader over UnitExternalRef. It does not hydrate through
 * the zone section-data endpoint because SourceSite/UnitExternalRef own this
 * data and canonical URL derivation.
 */
export function SourcesSection({
  section,
  ctx,
}: {
  section: ZoneSourcesSection;
  ctx: ZonePortalContext;
}) {
  const title = useZoneSectionTitle(section, ctx.refUnits);
  const query = useQuery(
    unitExternalRefListQueryOptions({
      unitId: ctx.zone.unitId,
      limit: section.limit,
    }),
  );

  if (query.isLoading) {
    return (
      <ZoneSectionShell title={title}>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </ZoneSectionShell>
    );
  }

  if (query.isError) {
    return (
      <ZoneSectionShell title={title}>
        <QueryErrorDisplay error={query.error} />
      </ZoneSectionShell>
    );
  }

  const refs = query.data?.refs ?? [];
  if (refs.length === 0) {
    return <ZoneSectionEmpty title={title} emptyState={section.emptyState} />;
  }

  return (
    <ZoneSectionShell title={title}>
      <ul className="flex flex-col gap-2">
        {refs.map((ref) => (
          <li key={ref.id}>
            <SafeLink
              href={ref.canonicalUrl}
              className="flex items-center justify-between gap-3 rounded-md bg-surface-subtle px-4 py-3 text-sm leading-ui transition-colors hover:bg-surface-sunken"
            >
              <span className="min-w-0 truncate font-medium text-text-primary">
                {sourceSiteLabel(ref, ctx.languages)}
              </span>
              <ExternalLink
                className="size-4 shrink-0 text-text-tertiary"
                aria-hidden
              />
            </SafeLink>
          </li>
        ))}
      </ul>
    </ZoneSectionShell>
  );
}
