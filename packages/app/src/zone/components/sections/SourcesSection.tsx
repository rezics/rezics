import { unitExternalLinksQueryOptions } from "@rezics/contract/api/unit-external-link";
import type { ZoneSourcesSection } from "@rezics/contract";
import { Skeleton } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { QueryErrorDisplay } from "@/core";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import {
  useZoneSectionTitle,
  type ZonePortalContext,
  ZoneSectionEmpty,
  ZoneSectionShell,
} from "./shared";

/**
 * Sources reads the display-ready Unit external-links model. The server stores
 * complete URLs and source Entity display data; crawler-specific URL parsing is
 * deliberately outside this UI path.
 */
export function SourcesSection({
  section,
  ctx,
}: {
  section: ZoneSourcesSection;
  ctx: ZonePortalContext;
}) {
  const title = useZoneSectionTitle(section, ctx.refUnits);
  const query = useQuery(unitExternalLinksQueryOptions(ctx.zone.unitId));

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

  const links = (query.data?.links ?? []).slice(0, section.limit);
  if (links.length === 0) {
    return <ZoneSectionEmpty title={title} emptyState={section.emptyState} />;
  }

  return (
    <ZoneSectionShell title={title}>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.id}>
            <SafeLink
              href={link.url}
              className="flex items-center justify-between gap-3 rounded-md bg-surface-subtle px-4 py-3 text-sm leading-ui transition-colors hover:bg-surface-sunken"
            >
              <span className="min-w-0 truncate font-medium text-text-primary">
                {link.label}
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
