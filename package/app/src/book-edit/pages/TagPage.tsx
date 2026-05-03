import { Alert } from "@mui/material";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import type React from "react";
import { bookEditLayoutRoute } from "@/router";
import TagListEdit from "@/tag/components/Edit/TagListEdit";

export const BookEditTagPage: React.FC = () => {
  const { bookId } = bookEditLayoutRoute.useParams();
  return (
    <div className="mt-16 mx-auto w-11/12">
      <div className="pl-4">
        <div className="flex mb-4">
          <AccentBarWithText text="Tag编辑" />
        </div>
        <div className="text-sm text-muted-foreground mb-4">
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
