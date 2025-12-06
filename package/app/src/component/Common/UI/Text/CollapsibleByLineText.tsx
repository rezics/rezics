import {useTheme} from '@mui/material/styles';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {MarkdownContent} from '../../MarkdownContent';

export type CollapsibleByLineTextShowProps = {
  content?: string;
  children?: React.ReactNode;
  maxLines?: number; // 行数阈值，默认 4
  isExpanded: boolean;
  onToggle: () => void;
};

export const CollapsibleByLineTextShow: React.FC<
  CollapsibleByLineTextShowProps
> = ({content, children, maxLines = 4, isExpanded, onToggle}) => {
  const {t} = useTranslation();
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      setIsOverflow(el.scrollHeight > el.clientHeight);
    });
  }, [content, maxLines]);

  return (
    <div className="relative text-base leading-snug">
      <div
        ref={containerRef}
        style={{
          WebkitLineClamp: isExpanded ? undefined : maxLines, // 动态控制行数
          display: '-webkit-box', // 需要这两个来启用多行文本裁剪
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {content ? <MarkdownContent content={content} /> : children}
        {isExpanded && (
          <button
            onClick={onToggle}
            className="ml-1 text-sm font-medium text-blue-600 hover:underline"
          >
            收起
          </button>
        )}
      </div>

      {!isExpanded && isOverflow && (
        <div className="absolute bottom-0 right-0 flex items-end">
          {/* 遮罩 */}
          {/* <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent pointer-events-none" /> */}
          <div
            className="relative flex justify-end z-10 px-2 pt-1"
            style={{
              width: '8rem',
              height: '100%',
              background: `linear-gradient(to left, ${theme.palette.background.default} 40%, transparent 100%)`,
            }}
          >
            <button
              onClick={onToggle}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {/* 展开 */}
              {t('common.expand')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export type CollapsibleByLineTextContainerProps = {
  content?: string;
  children?: React.ReactNode;
  maxLines?: number;
};

export const CollapsibleByLineTextContainer: React.FC<
  CollapsibleByLineTextContainerProps
> = ({content, children, maxLines = 4}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const toggle = () => setIsExpanded(v => !v);

  return (
    <CollapsibleByLineTextShow
      content={content}
      maxLines={maxLines}
      isExpanded={isExpanded}
      onToggle={toggle}
    >
      {children}
    </CollapsibleByLineTextShow>
  );
};
