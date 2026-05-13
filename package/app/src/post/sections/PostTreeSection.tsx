import { postThreadQuery } from "@rezics/api/post/post";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { PostDTO } from "@rezics/contract";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PostReply,
  postReplyThreadingMetrics,
  railLeftPxForLevel,
} from "../components/item/PostReply";
import { ReplyComposer } from "../forms/ReplyComposer";
import {
  excludeRootPost,
  usePostTreeCollapse,
} from "../hooks/usePostTreeCollapse";
import {
  findNearestVisibleAncestor,
  getContinuationLines,
  getDisplayDepth,
  hasLaterSiblingBranch,
  isDescendantPost,
} from "../models/postTreeRails";

interface PostTreeSectionProps {
  rootPostUnitId: string;
  maxDepth?: number;
  visualMaxDepth?: number;
  /**
   * When supplied, overrides the built-in "mount an inline composer" behaviour
   * (used by surfaces that need to navigate or otherwise intercept replies).
   */
  onReply?: (postUnitId: string) => void;
}

interface PostTreeListProps {
  posts: PostDTO[];
  rootPostUnitId: string;
  maxDepth?: number;
  visualMaxDepth?: number;
  baseDepth?: number;
  onReply?: (postUnitId: string) => void;
}

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_VISUAL_MAX_DEPTH = 4;
const RAIL_CENTER_OFFSET_PX = 6;
const RAIL_STROKE_WIDTH_PX = 2;
const RAIL_HIT_WIDTH_PX = 12;

interface RowBounds {
  top: number;
  bottom: number;
}

interface PostTreeRow {
  post: PostDTO;
  indentLevel: number;
  atMaxDepth: boolean;
  hasVisibleDescendants: boolean;
  hasThreadChildren: boolean;
  parentLine?: {
    level: number;
    postUnitId: string;
    continuesAfterElbow: boolean;
  };
  continuationLines: Array<{ level: number; postUnitId: string }>;
}

interface RailRange {
  top: number;
  bottom: number;
}

interface RailElbow {
  y: number;
  fromX: number;
  toX: number;
}

interface OverlayRail {
  key: string;
  postUnitId: string;
  x: number;
  ranges: RailRange[];
  elbows: RailElbow[];
}

function railCenterXForLevel(level: number): number {
  return railLeftPxForLevel(level) + RAIL_CENTER_OFFSET_PX;
}

function areRowBoundsEqual(
  a: Record<string, RowBounds>,
  b: Record<string, RowBounds>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) => a[key]?.top === b[key]?.top && a[key]?.bottom === b[key]?.bottom,
  );
}

function mergeRailRanges(ranges: RailRange[]): RailRange[] {
  const sorted = [...ranges].sort((a, b) => a.top - b.top);
  const merged: RailRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous && range.top <= previous.bottom + 0.5) {
      previous.bottom = Math.max(previous.bottom, range.bottom);
      continue;
    }
    merged.push({ ...range });
  }
  return merged;
}

function capRailRangesToLastElbow(
  ranges: RailRange[],
  elbows: RailElbow[],
): RailRange[] {
  if (elbows.length === 0) return ranges;
  const lastElbow = elbows.reduce((latest, elbow) =>
    elbow.y > latest.y ? elbow : latest,
  );
  const lastElbowRadius = Math.min(
    10,
    Math.max(0, Math.abs(lastElbow.toX - lastElbow.fromX)),
  );
  const lastVerticalY = Math.max(0, lastElbow.y - lastElbowRadius);
  return ranges
    .map((range) => ({
      top: range.top,
      bottom: Math.min(range.bottom, lastVerticalY),
    }))
    .filter((range) => range.bottom > range.top);
}

function elbowPathForPoints({ y, fromX, toX }: RailElbow): string {
  const radius = Math.min(10, Math.max(0, Math.abs(toX - fromX)));
  return [
    `M ${fromX} ${Math.max(0, y - radius)}`,
    `Q ${fromX} ${y} ${fromX + radius} ${y}`,
    `H ${toX}`,
  ].join(" ");
}

function PostTreeRailOverlay({
  rails,
  height,
  highlightedThreadUnitId,
  onToggleAncestorCollapse,
  onThreadHoverChange,
}: {
  rails: OverlayRail[];
  height: number;
  highlightedThreadUnitId?: string;
  onToggleAncestorCollapse: (postUnitId: string) => void;
  onThreadHoverChange: (postUnitId: string, hovered: boolean) => void;
}) {
  const baseMaskId = `post-tree-rail-mask-${useId().replaceAll(":", "")}`;

  if (height <= 0 || rails.length === 0) return null;

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 z-10 overflow-visible"
      height={height}
      style={{ pointerEvents: "auto" }}
      width="100%"
    >
      {rails.map((rail, index) => {
        const maskId = `${baseMaskId}-${index}`;
        const isActive = highlightedThreadUnitId === rail.postUnitId;
        const colorClass = isActive ? "text-brand-fill" : "text-border-whisper";
        const hitPath = [
          ...rail.ranges.map(
            (range) => `M ${rail.x} ${range.top} V ${range.bottom}`,
          ),
          ...rail.elbows.map(elbowPathForPoints),
        ].join(" ");

        return (
          <g key={rail.key} className={colorClass}>
            <defs>
              <mask
                id={maskId}
                maskUnits="userSpaceOnUse"
                x={0}
                y={0}
                width="100%"
                height={height}
              >
                <rect width="100%" height={height} fill="black" />
                {rail.ranges.map((range, rangeIndex) => (
                  <rect
                    key={`${rail.key}-range-${rangeIndex}`}
                    x={rail.x - RAIL_STROKE_WIDTH_PX / 2}
                    y={range.top}
                    width={RAIL_STROKE_WIDTH_PX}
                    height={Math.max(0, range.bottom - range.top)}
                    fill="white"
                  />
                ))}
                {rail.elbows.map((elbow, elbowIndex) => (
                  <path
                    key={`${rail.key}-elbow-${elbowIndex}`}
                    d={elbowPathForPoints(elbow)}
                    fill="none"
                    stroke="white"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={RAIL_STROKE_WIDTH_PX}
                  />
                ))}
              </mask>
            </defs>
            <rect
              width="100%"
              height={height}
              fill="currentColor"
              mask={`url(#${maskId})`}
              pointerEvents="none"
            />
            <path
              d={hitPath}
              fill="none"
              stroke="transparent"
              strokeWidth={RAIL_HIT_WIDTH_PX}
              pointerEvents="stroke"
              onClick={(event) => {
                event.stopPropagation();
                onToggleAncestorCollapse(rail.postUnitId);
              }}
              onMouseEnter={() =>
                onThreadHoverChange(rail.postUnitId, true)
              }
              onMouseLeave={() =>
                onThreadHoverChange(rail.postUnitId, false)
              }
            />
          </g>
        );
      })}
    </svg>
  );
}

export const PostTreeList: React.FC<PostTreeListProps> = ({
  posts,
  rootPostUnitId,
  maxDepth = DEFAULT_MAX_DEPTH,
  visualMaxDepth = DEFAULT_VISUAL_MAX_DEPTH,
  baseDepth = 0,
  onReply,
}) => {
  const allUnitIds = useMemo(
    () => posts.map((p) => p.unitId).filter(Boolean) as string[],
    [posts],
  );
  useReactionHydration(allUnitIds);
  const { isCollapsed, toggleCollapse, visiblePosts } =
    usePostTreeCollapse(posts);

  const [openComposers, setOpenComposers] = useState<Set<string>>(
    () => new Set(),
  );
  const [highlightedThreadUnitId, setHighlightedThreadUnitId] = useState<
    string | undefined
  >();
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [rowBounds, setRowBounds] = useState<Record<string, RowBounds>>({});

  const rows = useMemo<PostTreeRow[]>(
    () =>
      visiblePosts.map((post, index) => {
        const depth = post.depth ?? 0;
        const displayDepth = Math.max(0, depth - baseDepth);
        const indentLevel = Math.min(displayDepth, visualMaxDepth);
        const atMaxDepth =
          displayDepth === maxDepth && (post.directReplyCount ?? 0) > 0;
        const hasVisibleDescendants = visiblePosts.some((candidate) =>
          isDescendantPost(post, candidate),
        );
        const hasThreadChildren =
          (post.directReplyCount ?? 0) > 0 || hasVisibleDescendants;
        const parent = findNearestVisibleAncestor(
          visiblePosts.slice(0, index),
          post,
        );
        const parentLine = parent
          ? {
              level: getDisplayDepth(parent, baseDepth, visualMaxDepth),
              postUnitId: parent.unitId,
              continuesAfterElbow: hasLaterSiblingBranch(
                visiblePosts.slice(index + 1),
                parent,
                post,
              ),
            }
          : undefined;
        const continuationLines = getContinuationLines({
          visibleBefore: visiblePosts.slice(0, index),
          visibleAfter: visiblePosts.slice(index + 1),
          post,
          baseDepth,
          visualMaxDepth,
          parentLineLevel: parentLine?.level,
        });

        return {
          post,
          indentLevel,
          atMaxDepth,
          hasVisibleDescendants,
          hasThreadChildren,
          parentLine,
          continuationLines,
        };
      }),
    [baseDepth, maxDepth, visiblePosts, visualMaxDepth],
  );

  const measureRows = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const listRect = list.getBoundingClientRect();
    const next: Record<string, RowBounds> = {};
    for (const row of rows) {
      const element = rowRefs.current.get(row.post.unitId);
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      next[row.post.unitId] = {
        top: rect.top - listRect.top,
        bottom: rect.bottom - listRect.top,
      };
    }
    setRowBounds((current) =>
      areRowBoundsEqual(current, next) ? current : next,
    );
  }, [rows]);

  useLayoutEffect(() => {
    measureRows();
    const resizeObserver = new ResizeObserver(measureRows);
    if (listRef.current) resizeObserver.observe(listRef.current);
    for (const row of rows) {
      const element = rowRefs.current.get(row.post.unitId);
      if (element) resizeObserver.observe(element);
    }
    window.addEventListener("resize", measureRows);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureRows);
    };
  }, [measureRows, rows]);

  const overlayRails = useMemo<OverlayRail[]>(() => {
    const railMap = new Map<
      string,
      Omit<OverlayRail, "ranges"> & { ranges: RailRange[] }
    >();

    const ensureRail = (postUnitId: string, level: number) => {
      const key = `${postUnitId}-${level}`;
      const existing = railMap.get(key);
      if (existing) return existing;
      const rail = {
        key,
        postUnitId,
        x: railCenterXForLevel(level),
        ranges: [],
        elbows: [],
      };
      railMap.set(key, rail);
      return rail;
    };

    for (const row of rows) {
      const bounds = rowBounds[row.post.unitId];
      if (!bounds) continue;
      const centerY =
        bounds.top + postReplyThreadingMetrics.toggleCenterYPx;

      if (
        row.hasThreadChildren &&
        row.hasVisibleDescendants &&
        !isCollapsed(row.post.unitId)
      ) {
        ensureRail(row.post.unitId, row.indentLevel).ranges.push({
          top: centerY,
          bottom: bounds.bottom,
        });
      }

      for (const line of row.continuationLines) {
        ensureRail(line.postUnitId, line.level).ranges.push({
          top: bounds.top,
          bottom: bounds.bottom,
        });
      }

      if (row.parentLine) {
        const rail = ensureRail(row.parentLine.postUnitId, row.parentLine.level);
        rail.ranges.push({
          top: bounds.top,
          bottom: row.parentLine.continuesAfterElbow ? bounds.bottom : centerY,
        });
        rail.elbows.push({
          y: centerY,
          fromX: rail.x,
          toX: railCenterXForLevel(row.indentLevel),
        });
      }
    }

    return Array.from(railMap.values()).map((rail) => ({
      ...rail,
      ranges: capRailRangesToLastElbow(
        mergeRailRanges(rail.ranges),
        rail.elbows,
      ),
    }));
  }, [isCollapsed, rowBounds, rows]);

  const overlayHeight = useMemo(
    () =>
      Object.values(rowBounds).reduce(
        (height, bounds) => Math.max(height, bounds.bottom),
        0,
      ),
    [rowBounds],
  );

  const handleReplyClick = useCallback(
    (postUnitId: string) => {
      if (onReply) {
        onReply(postUnitId);
        return;
      }
      setOpenComposers((prev) => {
        if (prev.has(postUnitId)) return prev;
        const next = new Set(prev);
        next.add(postUnitId);
        return next;
      });
    },
    [onReply],
  );

  const handleComposerDone = useCallback((postUnitId: string) => {
    setOpenComposers((prev) => {
      if (!prev.has(postUnitId)) return prev;
      const next = new Set(prev);
      next.delete(postUnitId);
      return next;
    });
  }, []);

  const handleThreadHoverChange = useCallback(
    (postUnitId: string, hovered: boolean) => {
      setHighlightedThreadUnitId((current) => {
        if (hovered) return postUnitId;
        return current === postUnitId ? undefined : current;
      });
    },
    [],
  );

  return (
    <div ref={listRef} className="relative">
      <PostTreeRailOverlay
        rails={overlayRails}
        height={overlayHeight}
        highlightedThreadUnitId={highlightedThreadUnitId}
        onToggleAncestorCollapse={toggleCollapse}
        onThreadHoverChange={handleThreadHoverChange}
      />
      {rows.map((row) => {
        const { post } = row;
        const composerOpen = openComposers.has(post.unitId);
        return (
          <div
            key={post.unitId}
            ref={(element) => {
              if (element) {
                rowRefs.current.set(post.unitId, element);
              } else {
                rowRefs.current.delete(post.unitId);
              }
            }}
          >
            <PostReply
              post={post}
              indentLevel={row.indentLevel}
              parentLine={row.parentLine}
              continuationLines={row.continuationLines}
              highlightedThreadUnitId={highlightedThreadUnitId}
              isCollapsed={isCollapsed(post.unitId)}
              hasThreadChildren={row.hasThreadChildren}
              hasVisibleDescendants={row.hasVisibleDescendants}
              onToggleCollapse={() => toggleCollapse(post.unitId)}
              onToggleAncestorCollapse={toggleCollapse}
              onThreadHoverChange={handleThreadHoverChange}
              onReply={() => handleReplyClick(post.unitId)}
              renderAncestorRails={false}
              renderOwnRail={false}
              replyComposerSlot={
                composerOpen ? (
                  <ReplyComposer
                    mode="expanded"
                    autoFocus
                    targetUnitId={rootPostUnitId}
                    parentPostUnitId={post.unitId}
                    onSubmitted={() => handleComposerDone(post.unitId)}
                    onCancelled={() => handleComposerDone(post.unitId)}
                  />
                ) : null
              }
            />
            {row.atMaxDepth && (
              <div
                className="py-1"
                style={{ paddingLeft: `${(row.indentLevel + 1) * 20}px` }}
              >
                <TextLink
                  to="/post/$rootPostUnitId/continue/$unitId"
                  params={{
                    rootPostUnitId,
                    unitId: post.unitId,
                  }}
                >
                  <span className="text-xs text-text-brand">
                    Continue thread →
                  </span>
                </TextLink>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const PostTreeSection: React.FC<PostTreeSectionProps> = ({
  rootPostUnitId,
  maxDepth = DEFAULT_MAX_DEPTH,
  visualMaxDepth = DEFAULT_VISUAL_MAX_DEPTH,
  onReply,
}) => {
  const { data, isLoading } = useQuery(
    postThreadQuery(rootPostUnitId, { mode: "threaded", maxDepth }),
  );
  const posts = useMemo(
    () => excludeRootPost(data?.posts ?? [], rootPostUnitId),
    [data?.posts, rootPostUnitId],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <PostTreeList
      posts={posts}
      rootPostUnitId={rootPostUnitId}
      maxDepth={maxDepth}
      visualMaxDepth={visualMaxDepth}
      onReply={onReply}
    />
  );
};
