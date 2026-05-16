import { unitHref } from "@rezics/ui/primitive/link";
import { Button } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useUserProfileStore } from "@/user/states";

// MOCK: Reaction history page — waiting on reaction service /reactions/history endpoint
export const ReactionInfoPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useUserProfileStore((state) => state.user);

  return (
    <div className="w-11/12 mx-auto mt-16 px-4">
      <div className="flex items-center justify-between">
        <div className="mb-4">
          <h5 className="text-xl font-bold mb-2">互动信息</h5>
          <p className="text-sm text-text-secondary">
            查看你对内容的互动记录。
          </p>
        </div>
        <Button
          variant="ghost"
          className="text-text-brand"
          onClick={() =>
            navigate({
              to: currentUser?.unitId
                ? unitHref({
                    type: "USER",
                    unitId: currentUser.unitId,
                    slug: currentUser.slug ?? null,
                  })
                : "/user/me",
            })
          }
        >
          返回
        </Button>
      </div>

      <div className="py-16 text-center text-text-secondary">
        互动历史功能正在迁移中，请稍后再来。
      </div>
    </div>
  );
};

export default ReactionInfoPage;
