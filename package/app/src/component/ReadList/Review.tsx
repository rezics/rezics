import React from 'react';
import {IconButton, Paper, Tooltip} from '@mui/material';
import {ExpandMore, ExpandLess, ChatBubbleOutline} from '@mui/icons-material';
import {BookListViewItem} from '@/component/BookLib/BookList/BookListView.tsx';
import {navigate} from 'wouter/use-browser-location';
import {MarkdownContent} from '../Common/MarkdownContent';
import {ReviewHeader} from '@/component/Review/SingleReview';
import {useTranslation} from 'react-i18next';

export type ReviewData = {
  unitId: string;
  title?: string;
  content?: string;
};

type CollapsibleReviewProps = {
  review: ReviewData | null | undefined;
  defaultExpanded?: boolean;
  maxCollapsedLines?: number;
  className?: string;
  contentClassName?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
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
  contentClassName = 'text-[13px] sm:text-sm text-gray-700 leading-6',
  header,
  footer,
}) => {
  const {t} = useTranslation();
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
      className={`p-3 sm:p-4 rounded-lg backdrop-blur ${className}`}
      role="region"
      aria-label={t('readlist.a11y.book_review')}
    >
      {header}
      <div className="flex items-start gap-3">
        {/* md 以上才显示 */}
        <div className="hidden md:block">
          <Tooltip title={t('review.open_review_page')}>
            <IconButton
              aria-label={t('review.a11y.open_review_page')}
              onClick={() => navigate(`/review/${review?.unitId}`)}
            >
              <ChatBubbleOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>

        <div className="min-w-0 flex-1">
          {review?.title && (
            <p className="text-sm font-semibold leading-6 truncate">
              {review.title}
            </p>
          )}

          {/* collapsed preview using line-clamp when not expanded */}
          {review?.content && (
            <div className="relative">
              <div
                ref={contentRef}
                id={contentId}
                className={`overflow-hidden ${contentClassName}`}
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
                <MarkdownContent content={review?.content} />
              </div>

              {/* subtle gradient when collapsed and overflowing */}
              {!expanded && isOverflowing && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8  to-transparent" />
              )}

              {(isOverflowing || expanded) && (
                <div className="flex items-center justify-end mt-1.5">
                  <Tooltip
                    title={expanded ? t('common.collapse') : t('common.expand')}
                    placement="top"
                  >
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
      {footer}
    </Paper>
  );
};

export default CollapsibleReview;

function CollapsibleReviewContainer({
  review,
  defaultExpanded = false,
  maxCollapsedLines = 4,
  className = '',
  contentClassName = 'text-[13px] sm:text-sm text-gray-700 leading-6',
}: CollapsibleReviewProps) {
  return (
    <div className={`w-full ${className}`}>
      <CollapsibleReview
        review={review}
        header={<ReviewHeader review={review as any} />}
        defaultExpanded={defaultExpanded}
        maxCollapsedLines={maxCollapsedLines}
        contentClassName={contentClassName}
      />
    </div>
  );
}
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
        <CollapsibleReviewContainer review={review} />
      </div>
    </div>
  );
};
