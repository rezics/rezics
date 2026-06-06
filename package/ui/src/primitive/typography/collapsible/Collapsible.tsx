import { useTranslation } from "@rezics/i18n/react";
import { Ellipsis } from "lucide-react";
import type React from "react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../../shared/lib/utils";

export type CollapsibleProps = {
  children: React.ReactNode;
  maxLines: number;
  alignToggle?: "start" | "end";
  showMoreLabel?: string;
  showLessLabel?: string;
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
  className?: string;
};

const FADE_MASK =
  "linear-gradient(to bottom, black 0%, black 40%, transparent 95%)";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export const Collapsible: React.FC<CollapsibleProps> = ({
  children,
  maxLines,
  alignToggle = "start",
  showMoreLabel,
  showLessLabel,
  expanded: controlledExpanded,
  onExpandedChange,
  className,
}) => {
  const { t } = useTranslation(["ui"]);
  const isControlled = controlledExpanded !== undefined;
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;
  const resolvedShowMoreLabel = showMoreLabel ?? t("ui:collapsible_show_more");
  const resolvedShowLessLabel = showLessLabel ?? t("ui:collapsible_show_less");

  const [isOverflowing, setIsOverflowing] = useState(true);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const contentId = useId();

  useIsomorphicLayoutEffect(() => {
    const element = contentRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const el = contentRef.current;
      if (!el || isExpanded) return;
      const overflowing = el.scrollHeight - el.clientHeight > 1;
      setIsOverflowing((prev) => (prev === overflowing ? prev : overflowing));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [maxLines, children, isExpanded]);

  const handleToggle = useCallback(() => {
    const next = !isExpanded;
    onExpandedChange?.(next);
    if (!isControlled) setInternalExpanded(next);
  }, [isExpanded, isControlled, onExpandedChange]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleToggle();
      }
    },
    [handleToggle],
  );

  const showInlineCollapse = isExpanded && isOverflowing;
  const showOverlayExpand = !isExpanded && isOverflowing;

  const clampStyle: React.CSSProperties = isExpanded
    ? {}
    : {
        display: "-webkit-box",
        WebkitLineClamp: maxLines,
        lineClamp: maxLines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      };

  const fadeStyle: React.CSSProperties = showOverlayExpand
    ? { WebkitMaskImage: FADE_MASK, maskImage: FADE_MASK }
    : {};

  return (
    <div className={className} style={{ position: "relative" }}>
      <div
        ref={contentRef}
        id={contentId}
        style={{ ...clampStyle, ...fadeStyle }}
      >
        {children}
        {showInlineCollapse && (
          <>
            {" "}
            <button
              type="button"
              onClick={handleToggle}
              aria-expanded={isExpanded}
              aria-controls={contentId}
              className={cn(
                "inline cursor-pointer align-baseline border-0 bg-transparent p-0 font-medium",
                "text-[var(--colors-brand-fill)] hover:underline",
              )}
              style={{ font: "inherit", fontWeight: 500 }}
            >
              {resolvedShowLessLabel}
            </button>
          </>
        )}
      </div>

      {showOverlayExpand && (
        <div className={cn("group", "absolute inset-x-0 bottom-0 top-[40%]")}>
          {/* biome-ignore lint/a11y/useSemanticElements: button would collapse to icon size or inflate to fill area */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleToggle}
            onKeyDown={handleKeyDown}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={resolvedShowMoreLabel}
            className="absolute inset-0 cursor-pointer focus:outline-none"
          />
          <span
            aria-hidden
            className={cn(
              "absolute -bottom-1 h-[1lh]",
              alignToggle === "end" ? "right-0 pr-1" : "left-0 pl-1",
              "pointer-events-none inline-flex items-center",
              "text-text-secondary group-hover:text-[var(--colors-brand-fill)] group-focus-within:text-[var(--colors-brand-fill)] transition-colors duration-150 motion-reduce:transition-none",
            )}
          >
            <Ellipsis className="h-5 w-5" />
          </span>
        </div>
      )}
    </div>
  );
};
