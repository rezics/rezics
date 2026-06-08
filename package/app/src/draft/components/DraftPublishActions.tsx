import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { type PolicyDenial, PolicyDenialNotice } from "@/policy";

export interface DraftPublishActionsProps {
  /**
   * Persist the current content as a draft (create with `status: DRAFT`).
   * 将当前内容保存为草稿（以 `status: DRAFT` 创建）。
   */
  onSaveDraft: () => void;
  /**
   * Publish the content. Omit when the host already renders the primary
   * submit affordance (e.g. an editor footer owns the publish button) and
   * this component only contributes the secondary "Save draft" action.
   * 发布内容。当宿主已渲染主要的提交控件时（例如编辑器底栏拥有发布按钮），
   * 应省略此项，此时该组件仅提供次要的“Save draft”操作。
   */
  onPublish?: () => void;
  saveDraftLabel?: string;
  publishLabel?: string;
  /**
   * Disables every action while a save/publish request is in flight.
   * 当保存/发布请求处于进行中时，禁用所有操作。
   */
  isPending?: boolean;
  saveDraftDisabled?: boolean;
  publishDisabled?: boolean;
  /**
   * Inline policy denial from the last failed save/publish attempt.
   * 来自上一次保存/发布失败尝试的内联策略拒绝信息。
   */
  denial?: PolicyDenial | null;
  className?: string;
}

/**
 * Shared "Save draft" / "Publish" action row used by the big-editor create
 * forms (review, post, wiki, shelf description). The two actions coexist so a
 * draft can be kept private or published in one step. Inline editors (replies,
 * comments) intentionally do not use this — they have no draft lifecycle.
 * 由大型编辑器创建表单（评论、帖子、维基、书架描述）共用的“Save draft”/“Publish”
 * 操作行。两个操作并存，因此草稿可保持私有，或一步发布。内联编辑器（回复、
 * 评论）有意不使用此组件——它们没有草稿生命周期。
 */
export const DraftPublishActions: React.FC<DraftPublishActionsProps> = ({
  onSaveDraft,
  onPublish,
  saveDraftLabel,
  publishLabel,
  isPending = false,
  saveDraftDisabled = false,
  publishDisabled = false,
  denial = null,
  className,
}) => {
  const { t } = useTranslation(["common"]);
  return (
    <div className={`flex flex-col gap-2${className ? ` ${className}` : ""}`}>
      <PolicyDenialNotice denial={denial} />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onSaveDraft}
          disabled={isPending || saveDraftDisabled}
        >
          {saveDraftLabel ?? t("common:save_draft")}
        </Button>
        {onPublish ? (
          <Button
            type="button"
            onClick={onPublish}
            disabled={isPending || publishDisabled}
          >
            {publishLabel ?? t("common:publish")}
          </Button>
        ) : null}
      </div>
    </div>
  );
};
