import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import Link from "@mui/material/Link";
import type { SxProps, Theme } from "@mui/material/styles";
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
import { cn } from "@/shared/lib/utils";

export type CollapsibleProps = {
  children: React.ReactNode;
  maxLines: number;
  alignToggle?: "start" | "end";
  showMoreLabel?: string;
  showLessLabel?: string;
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
  className?: string;
  sx?: SxProps<Theme>;
};

const FADE_MASK =
  "linear-gradient(to bottom, black 0%, black 40%, transparent 95%)";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export const Collapsible: React.FC<CollapsibleProps> = ({
  children,
  maxLines,
  alignToggle = "start",
  showMoreLabel = "show more",
  showLessLabel = "show less",
  expanded: controlledExpanded,
  onExpandedChange,
  className,
  sx,
}) => {
  const isControlled = controlledExpanded !== undefined;
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

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
            <Link
              component="span"
              role="button"
              tabIndex={0}
              onClick={handleToggle}
              onKeyDown={handleKeyDown}
              aria-expanded={isExpanded}
              aria-controls={contentId}
              underline="hover"
              sx={[
                {
                  verticalAlign: "baseline",
                  font: "inherit",
                  fontWeight: 500,
                  cursor: "pointer",
                  color: "primary.main",
                },
                ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
              ]}
            >
              {showLessLabel}
            </Link>
          </>
        )}
      </div>

      {showOverlayExpand && (
        // Wrapper establishes the hover group; its top edge marks where the fade begins.
        // The click target fills this entire area.
        // The icon is pinned to the wrapper's bottom edge (= content's last line) via
        // `bottom-0` + `h-[1lh]`, completely independent of the wrapper's height.
        <div className={cn("group", "absolute inset-x-0 bottom-0 top-[40%]")}>
          {/* biome-ignore lint/a11y/useSemanticElements: button would collapse to icon size or inflate to fill area */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleToggle}
            onKeyDown={handleKeyDown}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={showMoreLabel}
            className="absolute inset-0 cursor-pointer focus:outline-none"
          />
          <span
            aria-hidden
            className={cn(
              "absolute -bottom-1 h-[1lh]",
              alignToggle === "end" ? "right-0 pr-1" : "left-0 pl-1",
              "pointer-events-none inline-flex items-center",
              "text-text-secondary group-hover:text-brand group-focus-within:text-brand transition-colors duration-150 motion-reduce:transition-none",
            )}
          >
            <MoreHorizIcon fontSize="medium" />
          </span>
        </div>
      )}
    </div>
  );
};
