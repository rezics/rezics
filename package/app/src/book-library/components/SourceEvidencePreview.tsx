import type { CreditAttributionEvidenceSummary } from "@rezics/contract";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
  Separator,
} from "@rezics/ui/shadcn";
import { ExternalLink } from "lucide-react";
import * as React from "react";
import { Link, AppSafeLink as SafeLink, unitHref } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";

export type SourceEvidencePreviewProps = {
  entityUnitId: string;
  entitySlug?: string | null;
  entityName: string;
  roleLabel: string;
  evidence?: readonly CreditAttributionEvidenceSummary[];
  className?: string;
};

export function SourceEvidencePreview({
  entityUnitId,
  entitySlug,
  entityName,
  roleLabel,
  evidence,
  className,
}: SourceEvidencePreviewProps) {
  const firstEvidence = evidence?.[0];
  const entityHref = unitHref({
    type: "ENTITY",
    unitId: entityUnitId,
    slug: entitySlug ?? null,
  });
  const [open, setOpen] = React.useState(false);

  if (!firstEvidence) {
    return (
      <Link
        to={entityHref}
        className={cn(
          "text-white/90 underline underline-offset-4 decoration-white/30 transition-colors hover:text-white hover:decoration-white/70",
          className,
        )}
      >
        {entityName}
      </Link>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        openOnHover
        delay={120}
        closeDelay={100}
        render={
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-sm text-white/90 underline underline-offset-4 decoration-white/30 outline-none transition-colors hover:text-white hover:decoration-white/70 focus-visible:ring-2 focus-visible:ring-white/40",
              className,
            )}
            onFocus={() => setOpen(true)}
          />
        }
      >
        <span>{entityName}</span>
        <ExternalLink className="size-3" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        className="w-72 rounded-lg border border-border-whisper bg-surface-elevated p-4 text-text-primary shadow-none"
      >
        <PopoverTitle className="text-base font-medium leading-ui">
          {entityName}
        </PopoverTitle>
        <PopoverDescription className="mt-1 text-sm leading-ui text-text-secondary">
          {roleLabel} · {sourceTitle(firstEvidence)}
        </PopoverDescription>

        <div className="mt-3 rounded-md bg-surface-subtle p-3 text-xs leading-normal text-text-secondary">
          <div className="font-mono text-text-primary">
            {firstEvidence.externalKind}:{firstEvidence.externalId}
          </div>
          {firstEvidence.claimPath ? (
            <div className="mt-1 font-mono">{firstEvidence.claimPath}</div>
          ) : null}
          <div className="mt-1">
            Observed {new Date(firstEvidence.observedAt).toLocaleString()}
          </div>
        </div>

        <Separator className="my-3" />

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            render={(props) => (
              <Link to={entityHref} {...props}>
                View Entity
              </Link>
            )}
          />
          <Button
            size="sm"
            variant="outline"
            render={(props) => (
              <SafeLink
                href={
                  firstEvidence.observedUrl ??
                  firstEvidence.originalUrl ??
                  firstEvidence.canonicalUrl
                }
                {...props}
              >
                Open Source
              </SafeLink>
            )}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function sourceTitle(evidence: CreditAttributionEvidenceSummary) {
  const source = evidence.sourceSite;
  return (
    source?.entity?.translations?.[0]?.title ??
    source?.entity?.slug ??
    source?.key ??
    evidence.sourceSiteEntityUnitId
  );
}
