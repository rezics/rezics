import Button from "@mui/material/Button";
import type { SxProps, Theme } from "@mui/material/styles";
import type React from "react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export type CollapsibleProps = {
  children: React.ReactNode;
  maxLines: number;
  fade?: boolean;
  alignToggle?: "start" | "end";
  showMoreLabel?: string;
  showLessLabel?: string;
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
  className?: string;
  sx?: SxProps<Theme>;
};

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export const Collapsible: React.FC<CollapsibleProps> = ({
  children,
  maxLines,
  fade = false,
  alignToggle = "start",
  showMoreLabel = "Show more",
  showLessLabel = "Show less",
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
      if (!el) return;
      const overflowing = el.scrollHeight - el.clientHeight > 1;
      setIsOverflowing((prev) => (prev === overflowing ? prev : overflowing));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [maxLines, children]);

  const handleToggle = useCallback(() => {
    const next = !isExpanded;
    onExpandedChange?.(next);
    if (!isControlled) setInternalExpanded(next);
  }, [isExpanded, isControlled, onExpandedChange]);

  const clampStyle: React.CSSProperties = isExpanded
    ? {}
    : {
        display: "-webkit-box",
        WebkitLineClamp: maxLines,
        lineClamp: maxLines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      };

  const fadeStyle: React.CSSProperties =
    fade && !isExpanded && isOverflowing
      ? {
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 85%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 85%, transparent 100%)",
        }
      : {};

  return (
    <div className={className}>
      <div
        style={{
          display: "grid",
          gridTemplateRows: "1fr",
          transition: "grid-template-rows 220ms ease",
        }}
      >
        <div style={{ minHeight: 0, overflow: "hidden" }}>
          <div
            ref={contentRef}
            id={contentId}
            style={{ ...clampStyle, ...fadeStyle }}
          >
            {children}
          </div>
        </div>
      </div>
      <Button
        type="button"
        variant="text"
        size="small"
        disableRipple
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        sx={[
          {
            px: 0,
            minWidth: 0,
            textTransform: "none",
            fontWeight: 500,
            alignSelf: alignToggle === "end" ? "flex-end" : "flex-start",
            display: isOverflowing ? "inline-flex" : "none",
            "@media (prefers-reduced-motion: reduce)": {
              transition: "none",
            },
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      >
        {isExpanded ? showLessLabel : showMoreLabel}
      </Button>
    </div>
  );
};
