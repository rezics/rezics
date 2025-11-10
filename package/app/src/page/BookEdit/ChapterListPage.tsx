import React, {useState, useEffect, useRef} from 'react';

import {LinearChapterList} from '@/component/Book/Chapter/LinearChapterList';
import {ChapterArboristHeightSlider} from '@/component/Book/Chapter/ChapterArboristHeightSlider';
import {AccentBarWithTextShow} from '@/component/Common/AccentBar';

interface BookEditChapterListPageProps {
  bookId: string;
}

/**
 * TODO 增加 JSON 编辑
 */
export const BookEditChapterListPage: React.FC<
  BookEditChapterListPageProps
> = ({bookId}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [parentWidth, setParentWidth] = useState<number>(0);
  const [chapterArboristHeight, setChapterArboristHeight] =
    useState<number>(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setParentWidth(el.clientWidth);
    };
    update();

    const observer = new ResizeObserver(() => update());
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="mt-10 mx-auto w-11/12" ref={containerRef}>
      <div className="pl-4">
        <div className="flex mb-4">
          <AccentBarWithTextShow text="章節编辑" />
        </div>
        <blockquote className="p-4 my-4 border-s-4 border-gray-300 bg-gray-50 dark:border-gray-500 dark:bg-gray-800">
          <p className="leading-relaxed text-gray-600 dark:text-white">
            右擊支持新增，頂部按鈕開啓后支持拖拽，重命名請开启Double-click
            Rename
          </p>
        </blockquote>
      </div>
      <ChapterArboristHeightSlider
        height={chapterArboristHeight}
        setHeight={setChapterArboristHeight}
      />
      <LinearChapterList
        bookId={bookId}
        isEdit={true}
        width={parentWidth - 20}
        height={chapterArboristHeight}
      />
      ;
    </div>
  );
};
