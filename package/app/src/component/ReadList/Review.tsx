import React from 'react';
import {IconButton, Paper, Tooltip} from '@mui/material';
import {ExpandMore, ExpandLess, ChatBubbleOutline} from '@mui/icons-material';
import {BookListViewItem} from '@/component/BookLib/BookList/BookListView.tsx';

export type ReviewData = {
  title?: string;
  content?: string;
};

type CollapsibleReviewProps = {
  review: ReviewData | null | undefined;
  defaultExpanded?: boolean;
  maxCollapsedLines?: number;
  className?: string;
};

/**
 * CollapsibleReview
 * - MUI + Tailwind styling
 * - Default collapsed, expand for full content
 * - Optimized for dense lists (many books)
 */
export const CollapsibleReview: React.FC<CollapsibleReviewProps> = ({
  review,
  defaultExpanded = false,
  maxCollapsedLines = 4,
  className = '',
}) => {
  const [expanded, setExpanded] = React.useState<boolean>(defaultExpanded);
  const contentId = React.useId();
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);

  // measure overflow only when collapsed
  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => {
      if (!el) return;
      if (expanded) {
        setIsOverflowing(false);
        return;
      }
      // Temporarily apply clamp to measure
      const prev = el.style.webkitLineClamp as unknown as string;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      el.style.webkitLineClamp = String(maxCollapsedLines);
      const overflowing = el.scrollHeight > el.clientHeight + 2; // allow tiny diff
      setIsOverflowing(overflowing);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      el.style.webkitLineClamp = prev ?? '';
    };
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [expanded, maxCollapsedLines]);

  if (!review?.title && !review?.content) return null;

  return (
    <Paper
      variant="outlined"
      className={`p-3 sm:p-4 rounded-lg border-gray-200/80 bg-white/70 backdrop-blur ${className}`}
      role="region"
      aria-label="Book review"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-gray-500">
          <ChatBubbleOutline fontSize="small" />
        </div>
        <div className="min-w-0 flex-1">
          {review?.title && (
            <p className="text-sm font-semibold text-gray-800 leading-6 truncate">
              {review.title}
            </p>
          )}

          {/* collapsed preview using line-clamp when not expanded */}
          {review?.content && (
            <div className="relative">
              <div
                ref={contentRef}
                id={contentId}
                className={
                  'text-[13px] sm:text-sm text-gray-700 leading-6 overflow-hidden'
                }
                style={
                  expanded
                    ? {display: 'block'}
                    : {
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: String(
                          maxCollapsedLines,
                        ) as unknown as number,
                      }
                }
              >
                {review.content}
              </div>

              {/* subtle gradient when collapsed and overflowing */}
              {!expanded && isOverflowing && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/90 to-transparent" />
              )}

              {(isOverflowing || expanded) && (
                <div className="flex items-center justify-end mt-1.5">
                  <Tooltip title={expanded ? '收起' : '展开'} placement="top">
                    <IconButton
                      size="small"
                      aria-expanded={expanded}
                      aria-controls={contentId}
                      onClick={() => setExpanded(v => !v)}
                    >
                      {expanded ? (
                        <ExpandLess fontSize="small" />
                      ) : (
                        <ExpandMore fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Paper>
  );
};

export default CollapsibleReview;

// Book + Review grouped presentation for ReadList pages
export const BookReviewGroup: React.FC<{
  book: any;
  review: ReviewData | null | undefined;
  className?: string;
}> = ({book, review, className = ''}) => {
  return (
    <div className={`w-full ${className}`}>
      <BookListViewItem book={book} />
      <div className="mt-3">
        <CollapsibleReview review={review} />
      </div>
    </div>
  );
};
