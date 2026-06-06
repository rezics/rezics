import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { type PolicyDenial, PolicyDenialNotice } from "@/policy";

export interface DraftPublishActionsProps {
  /** Persist the current content as a draft (create with `status: DRAFT`). */
  onSaveDraft: () => void;
  /**
   * Publish the content. Omit when the host already renders the primary
   * submit affordance (e.g. an editor footer owns the publish button) and
   * this component only contributes the secondary "Save draft" action.
   */
  onPublish?: () => void;
  saveDraftLabel?: string;
  publishLabel?: string;
  /** Disables every action while a save/publish request is in flight. */
  isPending?: boolean;
  saveDraftDisabled?: boolean;
  publishDisabled?: boolean;
  /** Inline policy denial from the last failed save/publish attempt. */
  denial?: PolicyDenial | null;
  className?: string;
}

/**
 * Shared "Save draft" / "Publish" action row used by the big-editor create
 * forms (review, post, wiki, shelf description). The two actions coexist so a
 * draft can be kept private or published in one step. Inline editors (replies,
 * comments) intentionally do not use this — they have no draft lifecycle.
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
