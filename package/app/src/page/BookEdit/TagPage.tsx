import React from 'react';
import {AccentBarWithTextShow} from '@/component/Common/Navigation/AccentBar';
import TagListEdit from '@/component/Tag/Edit/TagListEdit';
import {Alert} from '@mui/material';
import {bookEditLayoutRoute} from '@/router/router';

export const BookEditTagPage: React.FC = () => {
  const {bookId} = bookEditLayoutRoute.useParams();
  return (
    <div className="mt-10 mx-auto w-11/12">
      <div className="pl-4">
        <div className="flex mb-4">
          <AccentBarWithTextShow text="Tag编辑" />
        </div>
        <div className="text-sm text-gray-500 mb-4">
          为当前书籍管理标签：可新建标签，并按列表/域分组方式查看与解绑。
        </div>
        <Alert severity="info" className="mb-4">
          目前暂未开放domain注册, 请搜索并添加main域
        </Alert>
        <TagListEdit objectUnitId={bookId} className="max-w-xl" />
      </div>
    </div>
  );
};
