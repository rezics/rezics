import type { CommentDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { DropdownMenuItem } from "@rezics/ui/shadcn";
import { CircleCheck, CircleX, Pin, PinOff } from "lucide-react";
import type React from "react";

interface CommentPromotionControlsProps {
  /** Current promotion overlay of the reply (drives Pin↔Unpin / Accept↔Unaccept). 回复的当前置顶状态（驱动 Pin↔Unpin / Accept↔Unaccept）。 */
  pinKind: CommentDTO["pinKind"];
  /** Whether the pin/unpin control may render (viewer authority + `depth >= 1`). 是否可渲染 pin/unpin 控件（查看者权限 + `depth >= 1`）。 */
  canPin: boolean;
  /** Whether accept/unaccept may render (authority + Q&A thread + `depth === 1`). 是否可渲染 accept/unaccept（权限 + 问答帖 + `depth === 1`）。 */
  canAccept: boolean;
  /** Disable entries while a mutation is in flight. 当存在进行中的变更时禁用各条目。 */
  disabled?: boolean;
  onPin: () => void;
  onUnpin: () => void;
  onAccept: () => void;
  onUnaccept: () => void;
}

/**
 * Presentational promotion entries for the reply overflow menu. Renders the
 * single action that inverts the reply's current `pinKind` (Pin↔Unpin,
 * Accept↔Unaccept), or both Pin and Accept for an unpromoted reply. Returns
 * nothing when no action applies — authority and thread-context gating belong to
 * the caller (`CommentThreadSection`) via `canPin` / `canAccept`, keeping this
 * component free of session or authorization logic.
 * 回复溢出菜单的展示型置顶条目。渲染用于反转回复当前 `pinKind` 的单一操作
 * （Pin↔Unpin、Accept↔Unaccept），或为未置顶的回复同时渲染 Pin 和 Accept。
 * 当无操作适用时不渲染任何内容——权限与帖子上下文的门控由调用方
 * （`CommentThreadSection`）通过 `canPin` / `canAccept` 负责，使本组件不含
 * 会话或鉴权逻辑。
 */
export function CommentPromotionControls({
  pinKind,
  canPin,
  canAccept,
  disabled,
  onPin,
  onUnpin,
  onAccept,
  onUnaccept,
}: CommentPromotionControlsProps) {
  const { t } = useTranslation(["community"]);

  const entry = (
    key: string,
    icon: React.ReactNode,
    label: string,
    run: () => void,
  ) => (
    <DropdownMenuItem
      key={key}
      className="gap-2"
      disabled={disabled}
      onClick={(event) => event.stopPropagation()}
      onSelect={(event) => {
        event.stopPropagation();
        run();
      }}
    >
      {icon}
      <span>{label}</span>
    </DropdownMenuItem>
  );

  const entries: React.ReactNode[] = [];

  if (pinKind === "PINNED") {
    if (canPin) {
      entries.push(
        entry(
          "unpin",
          <PinOff size={16} strokeWidth={2} />,
          t("community:post_pin_action_unpin"),
          onUnpin,
        ),
      );
    }
  } else if (pinKind === "ACCEPTED_ANSWER") {
    if (canAccept) {
      entries.push(
        entry(
          "unaccept",
          <CircleX size={16} strokeWidth={2} />,
          t("community:post_pin_action_unaccept"),
          onUnaccept,
        ),
      );
    }
  } else {
    if (canPin) {
      entries.push(
        entry(
          "pin",
          <Pin size={16} strokeWidth={2} />,
          t("community:post_pin_action_pin"),
          onPin,
        ),
      );
    }
    if (canAccept) {
      entries.push(
        entry(
          "accept",
          <CircleCheck size={16} strokeWidth={2} />,
          t("community:post_pin_action_accept"),
          onAccept,
        ),
      );
    }
  }

  if (entries.length === 0) return null;
  return <>{entries}</>;
}
