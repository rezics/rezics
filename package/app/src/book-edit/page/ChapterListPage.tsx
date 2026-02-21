import React, {useState, useEffect, useRef} from 'react';

import {LinearChapterListEdit} from '@/book-edit/component/LinearChapterListEdit';
import {ChapterArboristHeightSlider} from '@/book-library/component/Chapter/ChapterArboristHeightSlider';
import {AccentBarWithTextShow} from '@/component/Navigation/AccentBar';
import {Alert, Button} from '@mui/material';
import {useQueryClient} from '@tanstack/react-query';
import {bookChapterIndexQuery} from '@package/api/book/book';

import {Tab, Tabs} from '@mui/material';
import {TabContext, TabPanel} from '@mui/lab';
import {ChapterTreeJsonEditor} from '@/book-library/component/Chapter/ChapterTreeJsonEditor';
import {bookEditLayoutRoute} from '@/router';

/**
 * TODO 增加 JSON 编辑
 */
export const BookEditChapterListPage: React.FC = () => {
  const {bookId} = bookEditLayoutRoute.useParams();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [parentWidth, setParentWidth] = useState<number>(0);
  const [chapterArboristHeight, setChapterArboristHeight] =
    useState<number>(800);
  const [tab, setTab] = useState<string>('normal');
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

  async function downloadJSON() {
    const chapterIndex = await queryClient.ensureQueryData(
      bookChapterIndexQuery(bookId),
    );
    const json = chapterIndex;
    const jsonString = JSON.stringify(json);
    const blob = new Blob([jsonString], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `chapterIndex-${bookId}-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-10 mx-auto w-11/12" ref={containerRef}>
      <div className="flex mb-4">
        <AccentBarWithTextShow text="章節编辑" />
      </div>
      <Alert severity="info" className="my-4">
        右擊支持新增，頂部按鈕開啓后支持拖拽，重命名請开启Double-click Rename
      </Alert>
      <div className="flex justify-between items-center">
        <div>
          下载JSON文件:&nbsp;我们强烈建议定期下载JSON文件以备份，防止章节列表更新损坏导致书籍章节信息丢失以及重建困难
        </div>
        <Button variant="contained" onClick={downloadJSON}>
          下载
        </Button>
      </div>
      <ChapterArboristHeightSlider
        height={chapterArboristHeight}
        setHeight={setChapterArboristHeight}
      />
      <div className="mt-4" />
      <TabContext value={tab}>
        <Tabs value={tab} onChange={(event, newValue) => setTab(newValue)}>
          <Tab label="普通编辑器" value="normal" />
          <Tab label="JSON编辑器" value="json" />
        </Tabs>
        <TabPanel value="normal">
          <LinearChapterListEdit
            bookId={bookId}
            isEdit={true}
            width={parentWidth - 20}
            height={chapterArboristHeight}
          />
        </TabPanel>
        <TabPanel value="json">
          <ChapterTreeJsonEditor bookId={bookId} />
        </TabPanel>
      </TabContext>
    </div>
  );
};
