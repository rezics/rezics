import type {
  ProgressPostLinkDTO,
  UserUnitProgressStatus,
} from "@rezics/contract";

export type ReasonStatus = Extract<
  UserUnitProgressStatus,
  "PAUSED" | "DROPPED"
>;

export function getReasonPostLinks(
  links: readonly ProgressPostLinkDTO[] | null | undefined,
  status: ReasonStatus,
): ProgressPostLinkDTO[] {
  return (links ?? []).filter((link) => link.status === status);
}

export function getLatestReasonPostId(
  links: readonly ProgressPostLinkDTO[] | null | undefined,
  status: ReasonStatus,
): string | null {
  const linksForStatus = getReasonPostLinks(links, status);
  return linksForStatus.length > 0
    ? linksForStatus[linksForStatus.length - 1].postUnitId
    : null;
}
