import type { PostDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { DropdownMenuItem } from "@rezics/ui/shadcn";
import { CircleCheck, CircleX, Pin, PinOff } from "lucide-react";
import type React from "react";

interface PostPromotionControlsProps {
  /** Current promotion overlay of the reply (drives Pin↔Unpin / Accept↔Unaccept). */
  pinKind: PostDTO["pinKind"];
  /** Whether the pin/unpin control may render (viewer authority + `depth >= 1`). */
  canPin: boolean;
  /** Whether accept/unaccept may render (authority + Q&A thread + `depth === 1`). */
  canAccept: boolean;
  /** Disable entries while a mutation is in flight. */
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
 * the caller (`PostTreeSection`) via `canPin` / `canAccept`, keeping this
 * component free of session or authorization logic.
 */
export function PostPromotionControls({
  pinKind,
  canPin,
  canAccept,
  disabled,
  onPin,
  onUnpin,
  onAccept,
  onUnaccept,
}: PostPromotionControlsProps) {
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
