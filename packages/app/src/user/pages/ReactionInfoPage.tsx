import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { unitHref } from "@/shared/ui/link";
import { useUserProfileStore } from "@/user/states";

// MOCK: Reaction history page — waiting on reaction service /reactions/history endpoint
// MOCK：互动历史页面 — 等待 reaction 服务的 /reactions/history 端点。

/**
 * Placeholder page for user reaction history. Currently displays a mock message
 * awaiting the /reactions/history API endpoint. Users can navigate back to profile.
 * 用户互动历史的占位页面。目前显示一条模拟消息，等待 /reactions/history API 端点。用户可导航返回个人资料。
 *
 * Layout:
 *
 * Mobile (<640px):
 * ┌─────────────────────┐
 * │ [Back Button] ⟲     │
 * ├─────────────────────┤
 * │ Reaction History    │
 * │ [Description text]  │
 * │                     │
 * │ [Feature Migration] │
 * │ [Message Text]      │
 * └─────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌──────────────────────────────┐
 * │ Reaction History    [Back] ⟲  │
 * │ [Description text]           │
 * │                              │
 * │                              │
 * │ [Feature Migration Message]  │
 * │ [User-friendly text]         │
 * │                              │
 * └──────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────┐
 * │ Reaction History    [Back to Profile] ⟲│
 * │ [Longer description text explaining]   │
 * │ [what reaction history is for users]   │
 * │                                        │
 * │                                        │
 * │ [Feature Under Migration]              │
 * │ [Placeholder message for users]        │
 * │                                        │
 * └────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌─────────────────────────────────────────────────┐
 * │ Reaction History            [Back to Profile] ⟲ │
 * │ [Full description of reaction history feature]  │
 * │ [and what users can expect when ready]          │
 * │                                                 │
 * │                                                 │
 * │ [Feature Under Migration - Centered Message]    │
 * │ [Come back soon to view your reaction history]  │
 * │                                                 │
 * └─────────────────────────────────────────────────┘
 */
export const ReactionInfoPage: React.FC = () => {
  const { t } = useTranslation(["settings"]);
  const navigate = useNavigate();
  const currentUser = useUserProfileStore((state) => state.user);

  return (
    <div className="w-full px-4 mt-16">
      <div className="flex items-center justify-between">
        <div className="mb-4">
          <h5 className="text-xl font-bold mb-2">
            {t("settings:profile_reaction_info_title")}
          </h5>
          <p className="text-sm text-text-secondary">
            {t("settings:profile_reaction_info_description")}
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
