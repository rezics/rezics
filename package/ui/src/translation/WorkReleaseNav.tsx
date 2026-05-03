import type React from "react";
import { Badge } from "@/shadcn/badge";

export interface WorkReleaseNavRelease {
  unitId: string;
  /** Resolved title for the current locale; caller chooses fallback. */
  title?: string;
}

interface WorkReleaseNavProps {
  releases: WorkReleaseNavRelease[];
  currentUnitId: string;
  /** Heading shown above the chip row. Caller localises. */
  heading?: string;
  /** Chip label fallback when a release has no resolved title. */
  emptyLabel?: string;
  /**
   * Renders the link wrapping each chip. The caller owns the routing target
   * so that typed-route tables stay inside the consuming app package.
   */
  renderLink: (
    release: WorkReleaseNavRelease,
    children: React.ReactNode,
  ) => React.ReactNode;
}

/**
 * Side-rail showing other releases of the same Work. The component is purely
 * presentational; data fetching and routing are owned by the caller.
 */
export const WorkReleaseNav: React.FC<WorkReleaseNavProps> = ({
  releases,
  currentUnitId,
  heading = "Other Editions",
  emptyLabel = "Edition",
  renderLink,
}) => {
  const others = releases.filter((r) => r.unitId !== currentUnitId);
  if (others.length === 0) return null;

  return (
    <div>
      <p className="text-sm font-semibold mb-1">{heading}</p>
      <div className="flex flex-row flex-wrap gap-2">
        {others.map((release) =>
          renderLink(
            release,
            <Badge
              key={release.unitId}
              variant="outline"
              className="cursor-pointer"
            >
              {release.title ?? emptyLabel}
            </Badge>,
          ),
        )}
      </div>
    </div>
  );
};
