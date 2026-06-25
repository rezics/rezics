import { useCanEdit } from "@rezics/contract/api/hooks/useCanEdit";
import { useCurrentUserId } from "@rezics/contract/api/hooks/useCurrentUserId";
import {
  useCastTagVoteMutation,
  useWithdrawUnitTagVoteMutation,
} from "@rezics/contract/api/tag/tag.mutations";
import type {
  BatchTagTranslationResult,
  BookDTO,
  UnitTagDTO,
} from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import { type InjectedTag, useNavigateToTagSearch } from "@/search";
import { TagVoteChipGroup } from "./TagVoteChipGroup";

export type TagInteractionProps = {
  tags: UnitTagDTO[];
  translations: BatchTagTranslationResult;
  bookUnitId: string;
  /**
   * The parent book; drives the edit-permission check.
   * 父书；驱动编辑权限检查。
   */
  bookUnit?: BookDTO;
  /**
   * Override the search navigation target. Defaults to global `/search`.
   * 覆盖搜索导航目标。默认为全局 `/search`。
   */
  onSearchTags?: (tags: InjectedTag[]) => void;
  className?: string;
};

/**
 * TagInteraction 是书籍详情页的 tag 探索入口：chip 云展示投票色彩，点击后
 * 可投票、编辑、查看定义，也可搜索单个或多个已选标签。
 *
 * Mobile
 * +------------------------------+
 * | [tag chips wrap by parent]   |
 * | popover action rows wrap     |
 * | selected bar when multi      |
 * +------------------------------+
 *
 * Tablet
 * +------------------------------------------+
 * | parent width, not viewport, decides rows |
 * | search selected appears below chips      |
 * +------------------------------------------+
 *
 * Desktop
 * +------------------------------------------------+
 * | dense inline chips with vote color state       |
 * | up/down/edit grouped; search/info grouped      |
 * +------------------------------------------------+
 *
 * Ultra-wide
 * +------------------------------------------------+
 * | parent layout controls readable row length     |
 * +------------------------------------------------+
 */
export function TagInteraction({
  tags,
  translations,
  bookUnitId,
  bookUnit,
  onSearchTags,
  className,
}: TagInteractionProps) {
  const userId = useCurrentUserId();
  const navigate = useNavigate();
  const defaultNavigateToSearch = useNavigateToTagSearch();
  const navigateToTagSearch = onSearchTags ?? defaultNavigateToSearch;
  const canEditTags = useCanEdit({ resource: "tag", ownerUnit: bookUnit });
  const voteMutation = useCastTagVoteMutation();
  const withdrawMutation = useWithdrawUnitTagVoteMutation();

  return (
    <TagVoteChipGroup
      tags={tags}
      translations={translations}
      emptyText=""
      className={className}
      votePending={
        !userId || voteMutation.isPending || withdrawMutation.isPending
      }
      onVote={(tagUnitId, value) => {
        if (!userId) return;
        voteMutation.mutate({ tagUnitId, unitId: bookUnitId, value });
      }}
      onWithdraw={(tagUnitId) => {
        if (!userId) return;
        withdrawMutation.mutate({ tagUnitId, unitId: bookUnitId });
      }}
      onEditTags={
        canEditTags
          ? () => navigate({ to: `/book/${bookUnitId}/edit/tag` })
          : undefined
      }
      onSearchTags={navigateToTagSearch}
    />
  );
}
