import type { FC, ReactNode } from "react";
import { Button } from "@/shadcn/button";

export interface CookieConsentBannerProps {
  title: string;
  body: string;
  policyLabel: string;
  onAccept: () => void;
  onPolicyClick: () => void;
  acceptLabel?: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  policyAction?: ReactNode;
}

export const CookieConsentBanner: FC<CookieConsentBannerProps> = ({
  title,
  body,
  policyLabel,
  onAccept,
  onPolicyClick,
  acceptLabel = "Accept",
  secondaryAction,
  policyAction,
}) => {
  return (
    <section aria-label={title}>
      <section className="flex flex-col gap-4 rounded-lg border border-border-whisper p-4 bg-rezics-surface-base">
        <div>
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="text-sm text-rezics-fg-muted">{body}</p>
        </div>
        <div className="flex flex-row flex-wrap gap-2">
          {policyAction ?? (
            <Button type="button" variant="ghost" onClick={onPolicyClick}>
              {policyLabel}
            </Button>
          )}
          {secondaryAction ? (
            <Button
              type="button"
              variant="outline"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          ) : null}
          <Button type="button" variant="default" onClick={onAccept}>
            {acceptLabel}
          </Button>
        </div>
      </section>
    </section>
  );
};
