import { useCanEdit, useCurrentUserId } from "@rezics/api/hooks";
import {
  useCastTagVoteMutation,
  useWithdrawUnitTagVoteMutation,
} from "@rezics/api/tag/tag";
import type {
  BatchTagTranslationResult,
  BookDTO,
  UnitTagDTO,
} from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type { InjectedTag } from "@/search";
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
   * Kept for compatibility with older callers. Tag detail navigation is now
   * handled in the shared chip popover.
   * 保留给旧调用点兼容。标签详情导航现在由共享 chip 浮层处理。
   */
  onSearchTags?: (tags: InjectedTag[]) => void;
  className?: string;
};

/**
 * TagInteraction 现在是书籍页对共享 TagVoteChipGroup 的薄包装：书籍页与编辑页
 * 使用同一套 chip、popover、赞成/反对/撤销投票交互。
 *
 * Mobile
 * +------------------------------+
 * | [tag chips wrap]             |
 * | tap chip -> vote popover     |
 * +------------------------------+
 *
 * Tablet
 * +------------------------------------------+
 * | chips wrap, popover anchored to chip     |
 * +------------------------------------------+
 *
 * Desktop
 * +------------------------------------------------+
 * | dense inline chips with vote color state       |
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
  className,
}: TagInteractionProps) {
  const userId = useCurrentUserId();
  const navigate = useNavigate();
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
    />
  );
}
