import { unitHref } from "@/shared/ui/link";
import { Button } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import * as m from "@rezics/i18n/messages";
import { useUserProfileStore } from "@/user/states";

// MOCK: Reaction history page — waiting on reaction service /reactions/history endpoint
export const ReactionInfoPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useUserProfileStore((state) => state.user);

  return (
    <div className="w-11/12 mx-auto mt-16 px-4">
      <div className="flex items-center justify-between">
        <div className="mb-4">
          <h5 className="text-xl font-bold mb-2">
            {m.profile_reaction_info_title()}
          </h5>
          <p className="text-sm text-text-secondary">
            {m.profile_reaction_info_description()}
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
